/**
 * Default radius (in km) for fetching venues from OpenStreetMap for each city.
 * 
 * Used by:
 * - Admin dashboard when refreshing venues
 * - MapView when fetching venues for user's city
 * 
 * Larger cities get larger radii to capture the greater metro area.
 * Cities not in this map get the DEFAULT_RADIUS.
 */

export const CITY_RADIUS_KM: Record<string, number> = {
  // Major metro areas - larger radius
  'Oslo': 45,
  'Bergen': 25,
  'Trondheim': 20,
  'Stavanger': 20,
  'Kristiansand': 15,
  
  // Medium cities
  'Tromsø': 15,
  'Drammen': 15,
  'Fredrikstad': 12,
  'Sandnes': 15, // Part of Stavanger metro
  'Sarpsborg': 12, // Part of Fredrikstad metro
  'Porsgrunn': 12,
  'Skien': 12, // Part of Grenland area
  'Ålesund': 15,
  'Sandefjord': 12,
  'Tønsberg': 12,
  'Moss': 10,
  'Haugesund': 12,
  'Bodø': 12,
  'Hamar': 12,
  'Larvik': 10,
  
  // Smaller cities
  'Lillehammer': 10,
  'Gjøvik': 10,
  'Molde': 10,
  'Harstad': 10,
  'Narvik': 8,
  'Alta': 10,
  'Arendal': 10,
  'Grimstad': 8,
  'Halden': 8,
  'Kongsberg': 8,
};

/**
 * Default radius for cities not in the map above
 */
export const DEFAULT_RADIUS_KM = 10;

/**
 * Get the recommended radius for a city
 */
export function getCityRadius(cityName: string): number {
  return CITY_RADIUS_KM[cityName] ?? DEFAULT_RADIUS_KM;
}

/**
 * Default city to use as fallback when user's city is not supported
 */
export const DEFAULT_FALLBACK_CITY = 'Trondheim';
export const DEFAULT_FALLBACK_CITY_ID = 1; // Will be updated after migration runs

