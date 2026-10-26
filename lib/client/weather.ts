import type { WeatherSnapshot } from "@/lib/types";
import { weatherCodeText } from "@/lib/domain/weather";

const LAST_POS = "wardrobe:lastPosition";

function getPosition(timeoutMs = 6000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("No geolocation"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      {
        timeout: timeoutMs,
        maximumAge: 30 * 60 * 1000,
        enableHighAccuracy: false,
      },
    );
  });
}

/** Current weather from Open-Meteo (free, no key) at the device position (or the last known one). */
export async function fetchWeather(): Promise<WeatherSnapshot> {
  let pos: { lat: number; lon: number } | null = null;
  try {
    pos = await getPosition();
    localStorage.setItem(LAST_POS, JSON.stringify(pos));
  } catch {
    const saved = localStorage.getItem(LAST_POS);
    pos = saved ? JSON.parse(saved) : null;
  }
  if (!pos) throw new Error("Location unavailable — set the weather manually.");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat.toFixed(3)}&longitude=${pos.lon.toFixed(3)}` +
    `&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather service unavailable");
  const d = await res.json();
  return {
    temp_c: d.current?.temperature_2m ?? null,
    temp_min_c: d.daily?.temperature_2m_min?.[0] ?? null,
    temp_max_c: d.daily?.temperature_2m_max?.[0] ?? null,
    precipitation_mm: d.current?.precipitation ?? null,
    rain_chance: d.daily?.precipitation_probability_max?.[0] ?? null,
    wind_kmh: d.current?.wind_speed_10m ?? null,
    description: weatherCodeText(d.current?.weather_code),
  };
}
