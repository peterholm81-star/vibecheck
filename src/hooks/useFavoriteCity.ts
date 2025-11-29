import { useEffect, useState } from "react";

const STORAGE_KEY = "vibecheck_favorite_city";

export function useFavoriteCity() {
  const [favoriteCity, setFavoriteCityState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setFavoriteCityState(raw);
    } catch {
      // ignorer localStorage-feil
    }
  }, []);

  const setFavoriteCity = (city: string | null) => {
    try {
      if (city) {
        window.localStorage.setItem(STORAGE_KEY, city);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignorer localStorage-feil
    }
    setFavoriteCityState(city);
  };

  return { favoriteCity, setFavoriteCity };
}

