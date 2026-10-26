import type { WeatherSnapshot } from "@/lib/types";

export function describeWeather(w: WeatherSnapshot | null | undefined): string {
  if (!w || w.temp_c === null || w.temp_c === undefined) return "unknown";
  const parts = [`${Math.round(w.temp_c)}°C now`];
  if (w.temp_min_c != null && w.temp_max_c != null)
    parts.push(`range ${Math.round(w.temp_min_c)}–${Math.round(w.temp_max_c)}°C`);
  if (w.rain_chance != null) parts.push(`${Math.round(w.rain_chance)}% chance of rain`);
  if (w.precipitation_mm) parts.push(`${w.precipitation_mm} mm precipitation`);
  if (w.wind_kmh != null) parts.push(`wind ${Math.round(w.wind_kmh)} km/h`);
  if (w.description) parts.push(w.description);
  return parts.join(", ");
}

/** WMO weather code → short text (Open-Meteo). */
export function weatherCodeText(code: number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  if (code === 0) return "clear";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}
