import { apiFetch } from './http.js';
/**
 * Mosque finder API client. All results come from OpenStreetMap
 * (Nominatim + Overpass) via the backend — nothing is invented.
 * Phone/website appear only when OpenStreetMap has them.
 */

export type Mosque = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  phone: string | null;
  website: string | null;
  directionsUrl: string;
  source: string;
};

export type MosqueResult = {
  source: string;
  city?: string;
  place?: string;
  centre?: { lat: number; lng: number };
  radiusKm: number;
  count: number;
  mosques: Mosque[];
  note?: string;
};

/**
 * Client-side backstop: the server bounds a city search at
 * ~35 s (10 s Nominatim + 25 s Overpass), so this aborts just
 * after that instead of spinning forever. A timeout surfaces as
 * a plain-language error the UI shows with a Retry button.
 */
export const MOSQUE_SEARCH_TIMEOUT_MS = 35_000;

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(path, {
      credentials: 'include',
      signal: AbortSignal.timeout(MOSQUE_SEARCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(
        'Mosque search timed out — OpenStreetMap is slow right now. Try again or try a smaller radius.',
      );
    }
    throw error;
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Mosque search failed.');
  }
  return data as T;
}

export async function fetchNearbyMosques(lat: number, lng: number, radiusKm = 10): Promise<MosqueResult> {
  return request(`/api/mosques/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`);
}

export async function searchMosquesByCity(city: string, radiusKm = 10): Promise<MosqueResult> {
  return request(`/api/mosques/search?city=${encodeURIComponent(city)}&radiusKm=${radiusKm}`);
}

export async function fetchMosquesNearMe(): Promise<MosqueResult> {
  return request('/api/mosques/near-me');
}
