/**
 * Shared city types and utilities for VibeCheck
 * 
 * Cities are fetched dynamically from the Supabase `cities` table.
 * This file provides shared types used across ProfileSettings, InsightsDashboard, etc.
 */

/**
 * CityOption for dropdown selectors
 * Used in both ProfileSettings and InsightsDashboard
 */
export type CityOption = {
  value: string;  // City name (used as filter value)
  label: string;  // Display label in dropdown
};

/**
 * Special value for "automatic GPS-based" city selection
 * Used in ProfileSettings for favorite city
 */
export const CITY_AUTO_VALUE = 'auto';

/**
 * Special value for "all cities" filter
 * Used in InsightsDashboard for city filter
 */
export const CITY_ALL_VALUE = 'all';

/**
 * Convert a City from API to CityOption format
 */
export function toCityOption(city: { name: string }): CityOption {
  return {
    value: city.name,
    label: city.name,
  };
}

/**
 * Convert array of cities to CityOption array
 */
export function toCityOptions(cities: Array<{ name: string }>): CityOption[] {
  return cities.map(toCityOption);
}

