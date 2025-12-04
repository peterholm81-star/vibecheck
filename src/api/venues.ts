// src/api/venues.ts
// API-funksjoner for å kalle venues Edge Functions

import { supabase } from "../lib/supabase";

export type FetchVenuesForCityParams = {
  cityId: number;
  radiusKm: number;
  includeCafeRestaurant?: boolean;
};

export type GetVenuesForCityParams = {
  cityId: number;
  userLat: number;
  userLon: number;
  radiusKm?: number;
  nightlifeOnly?: boolean;
  includeCafeRestaurant?: boolean;
  limit?: number;
};

export type VenueWithDistance = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string | null;
  is_nightlife: boolean;
  is_default_in_list: boolean;
  distance_km: number;
};

export type FetchVenuesResponse = {
  city: {
    id: number;
    name: string;
    country_code: string | null;
    center_lat: number;
    center_lon: number;
  };
  requested_radius_km: number;
  include_cafe_restaurant: boolean;
  inserted: number;
  venues_sample: Array<{
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    category: string | null;
    is_nightlife: boolean;
  }>;
};

export type GetVenuesResponse = {
  city: {
    id: number;
    name: string;
    country_code: string;
    center_lat: number;
    center_lon: number;
  };
  venues: VenueWithDistance[];
};

/**
 * Kaller den tunge Edge Function som oppdaterer venues-tabellen
 * ved å hente data fra OpenStreetMap/Overpass API.
 */
export async function refreshVenuesForCity(
  params: FetchVenuesForCityParams
): Promise<FetchVenuesResponse> {
  const { cityId, radiusKm, includeCafeRestaurant = false } = params;

  const { data, error } = await supabase.functions.invoke(
    "fetch_venues_for_city",
    {
      body: {
        cityId,
        radiusKm,
        includeCafeRestaurant,
      },
    }
  );

  if (error) {
    console.error("refreshVenuesForCity error", error);
    throw error;
  }

  // data vil være noe ala:
  // { city: {...}, inserted: number, venues_sample: [...] }
  return data as FetchVenuesResponse;
}

/**
 * Leser venues via den lette Edge Function.
 * Returnerer venues innenfor en gitt radius fra brukerens posisjon.
 */
export async function getVenuesForCity(
  params: GetVenuesForCityParams
): Promise<GetVenuesResponse> {
  const {
    cityId,
    userLat,
    userLon,
    radiusKm = 5,
    nightlifeOnly = true,
    includeCafeRestaurant = false,
    limit = 200,
  } = params;

  const { data, error } = await supabase.functions.invoke(
    "get_venues_for_city",
    {
      body: {
        cityId,
        userLat,
        userLon,
        radiusKm,
        nightlifeOnly,
        includeCafeRestaurant,
        limit,
      },
    }
  );

  if (error) {
    console.error("getVenuesForCity error", error);
    throw error;
  }

  // forventet form:
  // { city: {...}, venues: [...] }
  return data as GetVenuesResponse;
}
