/**
 * Shared city types and utilities for VibeCheck
 * 
 * Cities are fetched dynamically from the Supabase `cities` table.
 * This file provides shared types used across ProfileSettings, InsightsDashboard, etc.
 */

/**
 * CityOption for dropdown selectors (uses city name as value)
 * Used in ProfileSettings for favorite city
 */
export type CityOption = {
  value: string;  // City name (used as filter value in ProfileSettings)
  label: string;  // Display label in dropdown
};

/**
 * CityOptionById for dropdown selectors (uses city ID as value)
 * Used in InsightsDashboard for filtering venues by city_id
 */
export type CityOptionById = {
  id: number;     // City ID from cities table
  value: string;  // String representation of ID for select element
  label: string;  // Display label in dropdown (city name)
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
 * Convert a City from API to CityOption format (uses name as value)
 * Used in ProfileSettings
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

/**
 * Convert a City from API to CityOptionById format (uses ID as value)
 * Used in InsightsDashboard for venue filtering
 */
export function toCityOptionById(city: { id: number; name: string }): CityOptionById {
  return {
    id: city.id,
    value: String(city.id),
    label: city.name,
  };
}

/**
 * Convert array of cities to CityOptionById array
 */
export function toCityOptionsById(cities: Array<{ id: number; name: string }>): CityOptionById[] {
  return cities.map(toCityOptionById);
}

