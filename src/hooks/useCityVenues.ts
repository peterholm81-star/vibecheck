// src/hooks/useCityVenues.ts
// Hook for å hente venues for en by til kartet

import { useEffect, useState } from "react";
import { getVenuesForCity, VenueWithDistance } from "../api/venues";

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
  cityId: number;
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
  refetch: () => void;
};

export function useCityVenues(options: UseCityVenuesOptions): UseCityVenuesResult {
  const {
    cityId,
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
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (!enabled || !cityId) {
      return;
    }

    let isCancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await getVenuesForCity({
          cityId,
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
        console.error(err);
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
  }, [cityId, userLat, userLon, radiusKm, nightlifeOnly, includeCafeRestaurant, limit, enabled, refetchTrigger]);

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1);
  };

  return { venues, loading, error, cityName, refetch };
}

