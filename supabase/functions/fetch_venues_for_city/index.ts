// Edge Function: fetch_venues_for_city
// Henter venues fra OpenStreetMap / Overpass, lagrer dem i `venues`-tabellen
// og returnerer et lite sammendrag.
//
// Forventer body (JSON):
// {
//   "cityId": 2,
//   "radiusKm": 5,
//   "includeCafeRestaurant": false,
//   "limit": 50
// }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Rebruk samme CORS-headers som i get_venues_for_city
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// Bruk service-role hvis tilgjengelig, ellers anon key (tilpass til hvordan prosjektet ditt er satt opp)
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_* key in environment");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type CityRow = {
  id: number;
  name: string;
  country_code: string | null;
  center_lat: number;
  center_lon: number;
};

type OverpassElement = {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

const NIGHTLIFE_AMENITIES = ["bar", "pub", "nightclub"];
const CAFE_RESTAURANT_AMENITIES = ["cafe", "restaurant"];

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed. Use POST." },
      405,
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      cityId?: number;
      radiusKm?: number;
      includeCafeRestaurant?: boolean;
      limit?: number;
    };

    const cityId = body.cityId;
    const radiusKm = body.radiusKm ?? 5;
    const includeCafeRestaurant = body.includeCafeRestaurant ?? false;
    const limit = body.limit ?? 50;

    if (!cityId || typeof cityId !== "number") {
      return jsonResponse(
        { error: "Missing or invalid `cityId` (number required)." },
        400,
      );
    }

    if (radiusKm <= 0 || radiusKm > 50) {
      return jsonResponse(
        {
          error:
            "`radiusKm` must be between 0 and 50 km (to protect Overpass API).",
        },
        400,
      );
    }

    // 1. Hent byen fra cities-tabellen
    const { data: city, error: cityError } = await supabase
      .from("cities")
      .select("*")
      .eq("id", cityId)
      .single<CityRow>();

    if (cityError || !city) {
      console.error("City lookup error:", cityError);
      return jsonResponse(
        { error: `City with id ${cityId} not found.` },
        404,
      );
    }

    const radiusMeters = radiusKm * 1000;

    // 2. Bygg Overpass-spørring
    const filtersNightlife = NIGHTLIFE_AMENITIES
      .map(
        (amenity) =>
          `node["amenity"="${amenity}"](around:${radiusMeters},${city.center_lat},${city.center_lon});`,
      )
      .join("\n");

    const filtersCafeRestaurant = CAFE_RESTAURANT_AMENITIES
      .map(
        (amenity) =>
          `node["amenity"="${amenity}"](around:${radiusMeters},${city.center_lat},${city.center_lon});`,
      )
      .join("\n");

    const overpassFilters = includeCafeRestaurant
      ? `${filtersNightlife}\n${filtersCafeRestaurant}`
      : filtersNightlife;

    const overpassQuery = `
      [out:json][timeout:25];
      (
        ${overpassFilters}
      );
      out body;
      >;
      out skel qt;
    `;

    // 3. Kall Overpass API
    const overpassResp = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      },
    );

    if (!overpassResp.ok) {
      const text = await overpassResp.text().catch(() => "");
      console.error("Overpass error:", overpassResp.status, text);
      return jsonResponse(
        { error: "Failed to fetch data from Overpass API." },
        502,
      );
    }

    const overpassJson = (await overpassResp.json()) as {
      elements?: OverpassElement[];
    };

    const elements = overpassJson.elements ?? [];

    // 4. Map Overpass-resultater til venues-rows
    const mappedVenues = elements
      .filter((el) => el.tags && el.tags.name)
      .map((el) => {
        const tags = el.tags ?? {};
        const amenity = tags.amenity;
        const isNightlife = amenity
          ? NIGHTLIFE_AMENITIES.includes(amenity)
          : false;

        const street = tags["addr:street"] ?? "";
        const houseNumber = tags["addr:housenumber"] ?? "";
        const addrCity = tags["addr:city"] ?? city.name;
        const parts = [street, houseNumber].filter(Boolean);
        let address = parts.join(" ");
        if (addrCity) {
          address = address ? `${address}, ${addrCity}` : addrCity;
        }

        return {
          name: tags.name,
          address: address || null,
          latitude: el.lat,
          longitude: el.lon,
          category: amenity ?? null,
          is_nightlife: isNightlife,
          is_default_in_list: isNightlife,
          city_id: city.id,
          // beholder felt for debugging og senere filtrering
          osm_id: el.id,
          osm_source: "overpass",
          source: "overpass",
        };
      });

    if (mappedVenues.length === 0) {
      // Ingen venues – men fortsatt ok respons
      return jsonResponse(
        {
          city: basicCityResponse(city),
          requested_radius_km: radiusKm,
          include_cafe_restaurant: includeCafeRestaurant,
          inserted: 0,
          venues_sample: [],
        },
        200,
      );
    }

    // 5. Slett gamle overpass-venues for byen
    const { error: deleteError } = await supabase
      .from("venues")
      .delete()
      .eq("city_id", city.id)
      .eq("osm_source", "overpass");

    if (deleteError) {
      console.error("Error deleting old venues:", deleteError);
      // Vi fortsetter, men logger feilen
    }

    // 6. Sett inn nye venues
    const { error: insertError } = await supabase
      .from("venues")
      .insert(mappedVenues);

    if (insertError) {
      console.error("Error inserting venues:", insertError);
      return jsonResponse(
        { error: "Failed to insert venues into database." },
        500,
      );
    }

    // Oppdater last_venues_refresh på city
    const { error: updateCityError } = await supabase
      .from("cities")
      .update({ last_venues_refresh: new Date().toISOString() })
      .eq("id", city.id);

    if (updateCityError) {
      console.error("Error updating city.last_venues_refresh:", updateCityError);
      // Ikke kritisk for klienten, så vi bare logger dette
    }

    const sample = mappedVenues.slice(0, Math.min(limit, 5));

    return jsonResponse(
      {
        city: basicCityResponse(city),
        requested_radius_km: radiusKm,
        include_cafe_restaurant: includeCafeRestaurant,
        inserted: mappedVenues.length,
        venues_sample: sample,
      },
      200,
    );
  } catch (error) {
    console.error("Unexpected error in fetch_venues_for_city:", error);
    return jsonResponse(
      { error: "Internal server error." },
      500,
    );
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function basicCityResponse(city: CityRow) {
  return {
    id: city.id,
    name: city.name,
    country_code: city.country_code,
    center_lat: city.center_lat,
    center_lon: city.center_lon,
  };
}
