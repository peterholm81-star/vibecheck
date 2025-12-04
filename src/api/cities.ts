// src/api/cities.ts
// API-funksjoner for å hente byer

import { supabase } from "../lib/supabase";

export type City = {
  id: number;
  name: string;
  country_code: string;
  center_lat: number;
  center_lon: number;
};

/**
 * Henter alle byer fra cities-tabellen, sortert etter navn.
 */
export async function getCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, country_code, center_lat, center_lon")
    .order("name", { ascending: true });

  if (error) {
    console.error("getCities error", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Henter en enkelt by basert på ID.
 */
export async function getCityById(cityId: number): Promise<City | null> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, country_code, center_lat, center_lon")
    .eq("id", cityId)
    .single();

  if (error) {
    console.error("getCityById error", error);
    return null;
  }

  return data;
}

