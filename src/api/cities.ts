// src/api/cities.ts
// API-funksjoner for å hente byer

import { supabase } from "../lib/supabase";
import { getCityRadius } from "../config/cityRadius";

export type City = {
  id: number;
  name: string;
  country_code: string;
  center_lat: number;
  center_lon: number;
};

/**
 * Extended city type with suggested radius for admin use
 */
export type CityWithRadius = City & {
  suggested_radius_km: number;
};

/**
 * Henter alle byer fra cities-tabellen, sortert etter navn.
 */
export async function getCities(): Promise<City[]> {
  console.log('[getCities] Fetching cities from Supabase...');
  
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, country_code, center_lat, center_lon")
    .order("name", { ascending: true });

  if (error) {
    console.error("[getCities] Supabase error:", error.message, error.code, error.details);
    throw new Error(`Supabase error: ${error.message} (${error.code})`);
  }

  console.log('[getCities] Success, received', data?.length ?? 0, 'cities');
  return data ?? [];
}

/**
 * Henter alle byer med foreslått radius (basert på TypeScript-konstanter).
 * Brukes av admin-dashboard for å vise anbefalt radius per by.
 */
export async function getCitiesWithRadius(): Promise<CityWithRadius[]> {
  const cities = await getCities();
  
  return cities.map(city => ({
    ...city,
    suggested_radius_km: getCityRadius(city.name),
  }));
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

/**
 * Finner nærmeste by basert på koordinater.
 * Returnerer null hvis ingen by er innenfor maxDistanceKm.
 */
export async function findNearestCity(
  lat: number, 
  lon: number, 
  maxDistanceKm: number = 100
): Promise<City | null> {
  const cities = await getCities();
  
  if (cities.length === 0) return null;
  
  let nearestCity: City | null = null;
  let nearestDistance = Infinity;
  
  for (const city of cities) {
    const distance = haversineDistance(lat, lon, city.center_lat, city.center_lon);
    if (distance < nearestDistance && distance <= maxDistanceKm) {
      nearestDistance = distance;
      nearestCity = city;
    }
  }
  
  return nearestCity;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
