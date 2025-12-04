// src/hooks/useCityVenues.ts
// Hook for å hente venues for en by til kartet

import { useEffect, useState, useCallback } from "react";
import { getVenuesForCity, VenueWithDistance } from "../api/venues";
import { getCities, City } from "../api/cities";

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

type UseCityVenuesOptions = {
  // Either provide cityId directly, or cityName to look up
  cityId?: number;
  cityName?: string;
  userLat: number;
  userLon: number;
  radiusKm?: number;
  nightlifeOnly?: boolean;
  includeCafeRestaurant?: boolean;
  limit?: number;
  enabled?: boolean;
};

type UseCityVenuesResult = {
  venues: VenuePoint[];
  loading: boolean;
  error: string | null;
  cityName: string | null;
  cityId: number | null;
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
  } = options;

  const [venues, setVenues] = useState<VenuePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [resolvedCityId, setResolvedCityId] = useState<number | null>(providedCityId ?? null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Resolve cityId from cityName if needed
  useEffect(() => {
    if (providedCityId) {
      setResolvedCityId(providedCityId);
      return;
    }

    if (!providedCityName) {
      setResolvedCityId(null);
      return;
    }

    // Look up cityId from cityName
    getCitiesCached()
      .then(cities => {
        const normalizedName = providedCityName.toLowerCase().trim();
        const city = cities.find(c => 
          c.name.toLowerCase() === normalizedName
        );
        
        if (city) {
          setResolvedCityId(city.id);
        } else {
          // Try partial match
          const partialMatch = cities.find(c =>
            c.name.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(c.name.toLowerCase())
          );
          
          if (partialMatch) {
            setResolvedCityId(partialMatch.id);
          } else {
            console.warn(`City "${providedCityName}" not found in cities table`);
            setResolvedCityId(null);
          }
        }
      })
      .catch(err => {
        console.error("Failed to fetch cities for lookup:", err);
        setResolvedCityId(null);
      });
  }, [providedCityId, providedCityName]);

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

        setCityName(data?.city?.name ?? null);
        
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
    refetch 
  };
}
