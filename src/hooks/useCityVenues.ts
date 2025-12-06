// src/hooks/useCityVenues.ts
// Hook for å hente venues for en by til kartet

import { useEffect, useState, useCallback } from "react";
import { getVenuesForCity, VenueWithDistance } from "../api/venues";
import { getCities, City, findNearestCity } from "../api/cities";
import { DEFAULT_FALLBACK_CITY } from "../config/cityRadius";

export type VenuePoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string | null;
  is_nightlife: boolean;
  is_default_in_list: boolean;
  distance_km: number;
};

/**
 * Status of city resolution:
 * - 'loading' - Still looking up city
 * - 'found' - City was found in our database
 * - 'not_supported' - User's city is not in our database
 * - 'fallback' - Using fallback city (e.g., Trondheim)
 * - 'error' - Error during lookup
 */
export type CityStatus = 'loading' | 'found' | 'not_supported' | 'fallback' | 'error';

type UseCityVenuesOptions = {
  // Either provide cityId directly, or cityName to look up
  cityId?: number;
  cityName?: string;
  // User's actual position (for distance calculations and nearest city lookup)
  userLat: number;
  userLon: number;
  radiusKm?: number;
  nightlifeOnly?: boolean;
  includeCafeRestaurant?: boolean;
  limit?: number;
  enabled?: boolean;
  // If true, will try to find nearest city when exact name match fails
  useNearestCity?: boolean;
  // If true, will fall back to default city (Trondheim) if no city found
  useFallback?: boolean;
};

type UseCityVenuesResult = {
  venues: VenuePoint[];
  loading: boolean;
  error: string | null;
  // The resolved city name (may differ from input if fallback was used)
  cityName: string | null;
  cityId: number | null;
  // Status of city resolution
  cityStatus: CityStatus;
  // The original city name detected (before any fallback)
  detectedCityName: string | null;
  // True if we're showing data for a different city than detected
  usingFallback: boolean;
  refetch: () => void;
};

// Cache for cities to avoid repeated fetches
let citiesCache: City[] | null = null;
let citiesCachePromise: Promise<City[]> | null = null;

async function getCitiesCached(): Promise<City[]> {
  if (citiesCache) return citiesCache;
  if (citiesCachePromise) return citiesCachePromise;
  
  citiesCachePromise = getCities().then(cities => {
    citiesCache = cities;
    return cities;
  }).catch(err => {
    citiesCachePromise = null;
    throw err;
  });
  
  return citiesCachePromise;
}

// Helper to find city by name (exact or partial match)
function findCityByName(cities: City[], name: string): City | undefined {
  const normalizedName = name.toLowerCase().trim();
  
  // Exact match first
  const exactMatch = cities.find(c => c.name.toLowerCase() === normalizedName);
  if (exactMatch) return exactMatch;
  
  // Partial match
  return cities.find(c =>
    c.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(c.name.toLowerCase())
  );
}

export function useCityVenues(options: UseCityVenuesOptions): UseCityVenuesResult {
  const {
    cityId: providedCityId,
    cityName: providedCityName,
    userLat,
    userLon,
    radiusKm = 5,
    nightlifeOnly = true,
    includeCafeRestaurant = false,
    limit = 200,
    enabled = true,
    useNearestCity = true,
    useFallback = true,
  } = options;

  const [venues, setVenues] = useState<VenuePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [resolvedCityId, setResolvedCityId] = useState<number | null>(providedCityId ?? null);
  const [cityStatus, setCityStatus] = useState<CityStatus>('loading');
  const [detectedCityName, setDetectedCityName] = useState<string | null>(providedCityName ?? null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Resolve cityId from cityName if needed
  useEffect(() => {
    // If cityId is provided directly, use it
    if (providedCityId) {
      setResolvedCityId(providedCityId);
      setCityStatus('found');
      setUsingFallback(false);
      return;
    }

    // If no cityName provided, we can't resolve
    if (!providedCityName) {
      setResolvedCityId(null);
      setCityStatus('loading');
      return;
    }

    // Save the detected city name
    setDetectedCityName(providedCityName);
    setCityStatus('loading');

    // Look up cityId from cityName
    getCitiesCached()
      .then(async (cities) => {
        // Try to find city by name
        const city = findCityByName(cities, providedCityName);
        
        if (city) {
          setResolvedCityId(city.id);
          setCityName(city.name);
          setCityStatus('found');
          setUsingFallback(false);
          return;
        }
        
        // City not found by name - try nearest city if enabled
        if (useNearestCity && userLat && userLon) {
          const nearest = await findNearestCity(userLat, userLon, 50); // 50km max
          if (nearest) {
            console.log(`City "${providedCityName}" not found, using nearest: ${nearest.name}`);
            setResolvedCityId(nearest.id);
            setCityName(nearest.name);
            setCityStatus('found');
            setUsingFallback(false);
            return;
          }
        }
        
        // Still not found - use fallback if enabled
        if (useFallback) {
          const fallbackCity = cities.find(c => c.name === DEFAULT_FALLBACK_CITY);
          if (fallbackCity) {
            console.log(`City "${providedCityName}" not supported, using fallback: ${DEFAULT_FALLBACK_CITY}`);
            setResolvedCityId(fallbackCity.id);
            setCityName(fallbackCity.name);
            setCityStatus('not_supported');
            setUsingFallback(true);
            return;
          }
        }
        
        // No fallback available
        console.warn(`City "${providedCityName}" not found in cities table and no fallback available`);
        setResolvedCityId(null);
        setCityStatus('not_supported');
        setUsingFallback(false);
      })
      .catch(err => {
        console.error("Failed to fetch cities for lookup:", err);
        setResolvedCityId(null);
        setCityStatus('error');
      });
  }, [providedCityId, providedCityName, userLat, userLon, useNearestCity, useFallback]);

  // Fetch venues when we have a cityId
  useEffect(() => {
    if (!enabled || !resolvedCityId) {
      return;
    }

    let isCancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await getVenuesForCity({
          cityId: resolvedCityId!,
          userLat,
          userLon,
          radiusKm,
          nightlifeOnly,
          includeCafeRestaurant,
          limit,
        });

        if (isCancelled) return;

        // Update cityName from response if not already set
        if (data?.city?.name) {
          setCityName(data.city.name);
        }
        
        // Map venues to VenuePoint format
        const mappedVenues: VenuePoint[] = (data?.venues ?? []).map((v: VenueWithDistance) => ({
          id: v.id,
          name: v.name,
          lat: v.lat,
          lon: v.lon,
          category: v.category,
          is_nightlife: v.is_nightlife,
          is_default_in_list: v.is_default_in_list,
          distance_km: v.distance_km,
        }));
        
        setVenues(mappedVenues);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error("useCityVenues error:", err);
        const errorMessage = err instanceof Error ? err.message : "Kunne ikke hente venues.";
        setError(errorMessage);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [resolvedCityId, userLat, userLon, radiusKm, nightlifeOnly, includeCafeRestaurant, limit, enabled, refetchTrigger]);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  return { 
    venues, 
    loading, 
    error, 
    cityName, 
    cityId: resolvedCityId,
    cityStatus,
    detectedCityName,
    usingFallback,
    refetch 
  };
}
