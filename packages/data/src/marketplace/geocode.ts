// Free geocoding via OpenStreetMap Nominatim.
// Respect their usage policy: ≤1 req/s, identify the app via a header
// (browsers ignore custom UA — we use a referer-friendly query param instead).

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  country?: string;
  city?: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

export async function geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Geocoder failed: ${res.status}`);

  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: { country?: string; city?: string; town?: string; village?: string };
  }>;

  return data.map((d) => ({
    label: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    country: d.address?.country,
    city: d.address?.city ?? d.address?.town ?? d.address?.village,
  }));
}

export async function geocodeFirst(query: string): Promise<GeocodeResult | null> {
  const [first] = await geocode(query, 1);
  return first ?? null;
}
