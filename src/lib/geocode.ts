import { SUPPORT_EMAIL } from "@/lib/constants/site";

/** Two decimal places is roughly 1 km: enough for distance, never a home address. */
export function coarse(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Turns "City, State, Country" into approximate coordinates using
 * OpenStreetMap's free Nominatim service (at most one lookup per profile
 * save). Set GEOCODING=off to disable, e.g. if usage grows past their
 * fair-use policy; members can still use their browser location.
 */
export async function geocodeCity(parts: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  if (process.env.GEOCODING === "off") return null;
  const q = [parts.city, parts.state, parts.country]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
  if (!parts.city?.trim() || q.length < 2) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("featureType", "city");
    const res = await fetch(url, {
      headers: {
        "User-Agent": `KindredKinks/1.0 (${SUPPORT_EMAIL || "support"})`,
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (!rows[0]) return null;
    return {
      latitude: coarse(Number(rows[0].lat)),
      longitude: coarse(Number(rows[0].lon)),
    };
  } catch {
    return null;
  }
}
