import { useEffect, useState } from "react";

export function useCityName() {
  const [cityName, setCityName] = useState("Trondheim");

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;

          const res = await fetch(url, {
            headers: { "Accept-Language": "en" },
          });

          const data = await res.json();
          const addr = data.address || {};

          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            "Trondheim";

          setCityName(city);
        } catch (error) {
          // fallback - behold Trondheim
        }
      },
      () => {
        // bruker avslo posisjon -> behold Trondheim
      }
    );
  }, []);

  return cityName;
}

