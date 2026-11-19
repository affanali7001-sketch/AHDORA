import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { haversineKm } from '../lib/geo.js';
import { Profile } from '../models/Profile.js';

/**
 * Mosque finder — real OpenStreetMap data only, keyless.
 *
 * Verified live 2026-11-19:
 *   Nominatim search "Pune, India" -> 200, Pune at 18.5213738, 73.8545071
 *   Overpass (around 5 km of Pune) -> 200, real results incl.
 *   "Makkah Masjid", "Farog E Nabavi Masjid", "Sadal Baba",
 *   "Mominpura Kabrastan Masjid".
 *
 * Nominatim usage policy: a proper identifying User-Agent is sent
 * on every request. Overpass is slow (tens of seconds on the public
 * instance), so the timeout is generous and failures are honest
 * 502s. Phone/website are included ONLY when OSM tags provide
 * them; nothing is ever invented. Results are sorted by distance.
 */

export const mosquesRouter = Router();

mosquesRouter.use(requireAuth);

const USER_AGENT = 'AHDORA/1.0 (Islamic learning app; educational use)';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

type Mosque = {
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

function addressFromTags(tags: Record<string, unknown>): string {
  const parts: string[] = [];
  const street = typeof tags['addr:street'] === 'string' ? tags['addr:street'] : '';
  const house = typeof tags['addr:housenumber'] === 'string' ? tags['addr:housenumber'] : '';
  const suburb = typeof tags['addr:suburb'] === 'string' ? tags['addr:suburb'] : '';
  const city = typeof tags['addr:city'] === 'string' ? tags['addr:city'] : '';
  const state = typeof tags['addr:state'] === 'string' ? tags['addr:state'] : '';
  const postcode = typeof tags['addr:postcode'] === 'string' ? tags['addr:postcode'] : '';
  if (house || street) parts.push([house, street].filter(Boolean).join(' '));
  if (suburb) parts.push(suburb);
  if (city) parts.push(city);
  if (state) parts.push(state);
  if (postcode) parts.push(postcode);
  return parts.join(', ');
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, unknown>;
};

function parseOverpass(payload: unknown, lat: number, lng: number): Mosque[] {
  const data = payload as { elements?: unknown[] } | null;
  if (!data || !Array.isArray(data.elements)) return [];
  const mosques: Mosque[] = [];
  for (const raw of data.elements) {
    const element = raw as OverpassElement;
    const tags = element.tags ?? {};
    const name = typeof tags.name === 'string' ? tags.name.trim() : '';
    const elementLat = element.lat ?? element.center?.lat;
    const elementLng = element.lon ?? element.center?.lon;
    if (!name || typeof elementLat !== 'number' || typeof elementLng !== 'number') continue;
    const phone =
      typeof tags.phone === 'string' && tags.phone.trim()
        ? tags.phone.trim()
        : typeof tags['contact:phone'] === 'string' && tags['contact:phone'].trim()
          ? (tags['contact:phone'] as string).trim()
          : null;
    const website =
      typeof tags.website === 'string' && tags.website.trim()
        ? tags.website.trim()
        : typeof tags['contact:website'] === 'string' && tags['contact:website'].trim()
          ? (tags['contact:website'] as string).trim()
          : null;
    mosques.push({
      id: `${element.type}-${element.id}`,
      name,
      address: addressFromTags(tags),
      latitude: elementLat,
      longitude: elementLng,
      distanceKm: Math.round(haversineKm(lat, lng, elementLat, elementLng) * 10) / 10,
      phone,
      website,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${elementLat},${elementLng}`,
      source: 'OpenStreetMap',
    });
  }
  mosques.sort((a, b) => a.distanceKm - b.distanceKm);
  return mosques;
}

async function fetchNearbyMosques(lat: number, lng: number, radiusKm: number): Promise<Mosque[]> {
  const radiusM = Math.round(radiusKm * 1000);
  const query =
    `[out:json][timeout:45];` +
    `(node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lng});` +
    `way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lng}););` +
    `out center 50;`;
  let response: Response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(50000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ data: query }),
    });
  } catch {
    throw new Error('UPSTREAM_UNREACHABLE');
  }
  if (!response.ok) throw new Error('UPSTREAM_FAILED');
  const payload = (await response.json().catch(() => null)) as unknown;
  return parseOverpass(payload, lat, lng);
}

async function geocodeCity(
  city: string,
  country: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url =
    `${NOMINATIM_URL}?format=json&limit=1` +
    `&q=${encodeURIComponent(`${city}, ${country}`)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
  } catch {
    throw new Error('UPSTREAM_UNREACHABLE');
  }
  if (!response.ok) throw new Error('UPSTREAM_FAILED');
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0] as { lat?: string; lon?: string; display_name?: string };
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: first.display_name ?? `${city}, ${country}` };
}

const nearbySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(25).optional(),
});

/**
 * GET /api/mosques/nearby?lat=..&lng=..&radiusKm=10 — mosques
 * near coordinates, nearest first. Empty list is an honest empty
 * result, not an error.
 */
mosquesRouter.get('/nearby', async (req, res) => {
  const parsed = nearbySchema.safeParse({
    lat: Number(req.query.lat),
    lng: Number(req.query.lng),
    radiusKm: req.query.radiusKm === undefined ? undefined : Number(req.query.radiusKm),
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid lat (-90..90), lng (-180..180) and radiusKm (1–25) are required.' });
    return;
  }
  const radiusKm = parsed.data.radiusKm ?? 10;
  try {
    const mosques = await fetchNearbyMosques(parsed.data.lat, parsed.data.lng, radiusKm);
    res.json({
      source: 'OpenStreetMap (Overpass API)',
      centre: { lat: parsed.data.lat, lng: parsed.data.lng },
      radiusKm,
      count: mosques.length,
      mosques,
    });
  } catch {
    res.status(502).json({ error: 'Mosque data could not be loaded from OpenStreetMap. Please try again later.' });
  }
});

const citySchema = z.object({
  city: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(100).optional(),
  radiusKm: z.number().min(1).max(25).optional(),
});

/**
 * GET /api/mosques/search?city=Pune&country=India&radiusKm=10 —
 * geocode the city with Nominatim, then search around it.
 */
mosquesRouter.get('/search', async (req, res) => {
  const parsed = citySchema.safeParse({
    city: req.query.city,
    country: req.query.country,
    radiusKm: req.query.radiusKm === undefined ? undefined : Number(req.query.radiusKm),
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'A city name is required (max 100 characters).' });
    return;
  }
  const radiusKm = parsed.data.radiusKm ?? 10;
  try {
    const place = await geocodeCity(parsed.data.city, parsed.data.country ?? 'India');
    if (!place) {
      res.json({
        source: 'OpenStreetMap (Nominatim + Overpass API)',
        city: parsed.data.city,
        radiusKm,
        count: 0,
        mosques: [],
        note: 'That place could not be found. Check the spelling or try a nearby larger city.',
      });
      return;
    }
    const mosques = await fetchNearbyMosques(place.lat, place.lng, radiusKm);
    res.json({
      source: 'OpenStreetMap (Nominatim + Overpass API)',
      city: parsed.data.city,
      place: place.displayName,
      centre: { lat: place.lat, lng: place.lng },
      radiusKm,
      count: mosques.length,
      mosques,
    });
  } catch {
    res.status(502).json({ error: 'Mosque data could not be loaded from OpenStreetMap. Please try again later.' });
  }
});

/**
 * GET /api/mosques/near-me — mosques near the user's profile city.
 * Uses the city from onboarding; no coordinates leave the server
 * beyond the Nominatim lookup for that city.
 */
mosquesRouter.get('/near-me', async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const profile = await Profile.findOne({ userId: req.authUser.id }).lean();
    const city = profile?.city?.trim();
    if (!city) {
      res.status(400).json({ error: 'Add your city in onboarding to find nearby mosques.' });
      return;
    }
    const radiusKm = 10;
    const place = await geocodeCity(city, profile?.country?.trim() || 'India');
    if (!place) {
      res.json({
        source: 'OpenStreetMap (Nominatim + Overpass API)',
        city,
        radiusKm,
        count: 0,
        mosques: [],
        note: 'Your city could not be found in OpenStreetMap. Try a manual city search.',
      });
      return;
    }
    const mosques = await fetchNearbyMosques(place.lat, place.lng, radiusKm);
    res.json({
      source: 'OpenStreetMap (Nominatim + Overpass API)',
      city,
      place: place.displayName,
      centre: { lat: place.lat, lng: place.lng },
      radiusKm,
      count: mosques.length,
      mosques,
    });
  } catch {
    res.status(502).json({ error: 'Mosque data could not be loaded from OpenStreetMap. Please try again later.' });
  }
});
