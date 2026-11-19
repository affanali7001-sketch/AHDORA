import { useState } from 'react';
import { Compass, MapPin, Navigation, Phone, Search } from 'lucide-react';
import {
  fetchMosquesNearMe,
  fetchNearbyMosques,
  searchMosquesByCity,
  type MosqueResult,
} from '../lib/mosquesApi';

/**
 * Mosque finder. Results come from OpenStreetMap (Nominatim +
 * Overpass) via the backend — name, address, distance and the
 * directions link only. Phone/website appear only when
 * OpenStreetMap has them; they are never invented.
 */
export default function MosqueFinder({
  onNotify,
  guestMode,
  profileCity,
}: {
  onNotify: (message: string) => void;
  guestMode: boolean;
  profileCity: string;
}) {
  const [city, setCity] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [result, setResult] = useState<MosqueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  async function run(promise: Promise<MosqueResult>) {
    setLoading(true);
    setError('');
    try {
      const data = await promise;
      setResult(data);
      if (data.count === 0) {
        onNotify('No mosques found in OpenStreetMap data for that area.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mosque search failed.');
    } finally {
      setLoading(false);
    }
  }

  function searchCity() {
    if (!city.trim()) {
      onNotify('Enter a city name first.');
      return;
    }
    run(searchMosquesByCity(city.trim(), radiusKm));
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      onNotify('Your browser does not support location access.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        run(fetchNearbyMosques(position.coords.latitude, position.coords.longitude, radiusKm));
      },
      () => {
        setLocating(false);
        onNotify('Location permission was not granted. Try a manual city search instead.');
      },
      { timeout: 15000 },
    );
  }

  return (
    <section className="mosque-finder">
      <div className="quran-browser-head">
        <div>
          <span className="eyebrow">MOSQUE FINDER · OPENSTREETMAP</span>
          <h3>Find a masjid near you</h3>
          <p>Real places from OpenStreetMap data. Distances are from your location or the searched city.</p>
        </div>
        <Compass size={22} />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="mosque-controls">
        <label className="quran-search">
          <Search size={16} />
          <input
            className="form-input"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Search a city, e.g. Pune"
            onKeyDown={(event) => {
              if (event.key === 'Enter') searchCity();
            }}
          />
        </label>
        <label className="field-label">
          Radius
          <select
            className="form-input"
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
          </select>
        </label>
        <button className="primary-button" onClick={searchCity} disabled={loading}>
          Search
        </button>
        <button className="outline-button" onClick={useMyLocation} disabled={loading || locating}>
          <Navigation size={15} /> {locating ? 'Locating…' : 'Use my location'}
        </button>
        {!guestMode && profileCity && (
          <button
            className="outline-button"
            onClick={() => run(fetchMosquesNearMe())}
            disabled={loading}
          >
            <MapPin size={15} /> Near {profileCity}
          </button>
        )}
      </div>

      {loading && <p className="empty-note">Searching OpenStreetMap… this can take a few seconds.</p>}

      {result && !loading && (
        <>
          <p className="quran-source-line">
            Source: {result.source}
            {result.place ? ` · ${result.place}` : ''}
            {result.note ? ` · ${result.note}` : ''}
          </p>
          {result.mosques.length === 0 ? (
            <p className="empty-note">
              No mosques found within {result.radiusKm} km in OpenStreetMap data. Try a larger
              radius or a nearby larger city.
            </p>
          ) : (
            <ul className="mosque-list">
              {result.mosques.map((mosque) => (
                <li key={mosque.id} className="panel mosque-card">
                  <div>
                    <strong>{mosque.name}</strong>
                    <span>
                      {mosque.distanceKm} km away
                      {mosque.address ? ` · ${mosque.address}` : ''}
                    </span>
                    {mosque.phone && (
                      <span>
                        <Phone size={13} /> {mosque.phone}
                      </span>
                    )}
                    {mosque.website && (
                      <a href={mosque.website} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    )}
                  </div>
                  <a
                    className="outline-button"
                    href={mosque.directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
