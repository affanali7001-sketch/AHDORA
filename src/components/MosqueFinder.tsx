import { useRef, useState } from 'react';
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
 *
 * Layout (preview #11, dark): .srow rows — mosque icon chip,
 * name + address, distance + peach Directions button right.
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
  // The last search, so a timeout/error can be retried with one
  // tap instead of retyping the city. A ref (not state) because
  // it only needs to exist when the Retry button is shown.
  const lastSearchRef = useRef<(() => void) | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  async function run(promise: Promise<MosqueResult>) {
    setLoading(true);
    setError('');
    setCanRetry(false);
    try {
      const data = await promise;
      setResult(data);
      if (data.count === 0) {
        onNotify('No mosques found in OpenStreetMap data for that area.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mosque search failed.');
      setCanRetry(lastSearchRef.current !== null);
    } finally {
      setLoading(false);
    }
  }

  function searchCity() {
    if (!city.trim()) {
      onNotify('Enter a city name first.');
      return;
    }
    const query = city.trim();
    const radius = radiusKm;
    const doSearch = () => run(searchMosquesByCity(query, radius));
    lastSearchRef.current = doSearch;
    doSearch();
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
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const radius = radiusKm;
        const doSearch = () => run(fetchNearbyMosques(lat, lng, radius));
        lastSearchRef.current = doSearch;
        doSearch();
      },
      () => {
        setLocating(false);
        onNotify('Location permission was not granted. Try a manual city search instead.');
      },
      { timeout: 15000 },
    );
  }

  return (
    <section className="sc-mosque">
      <div className="quran-browser-head">
        <div>
          <span className="eyebrow">MOSQUE FINDER · OPENSTREETMAP</span>
          <h3>Find a masjid near you</h3>
          <p>Real places from OpenStreetMap data. Distances are from your location or the searched city.</p>
        </div>
        <span className="iconbtn"><Compass size={18} /></span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="mosque-controls">
        <label className="searchbar">
          <Search size={16} />
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Search a city, e.g. Pune"
            aria-label="Search a city"
            onKeyDown={(event) => {
              if (event.key === 'Enter') searchCity();
            }}
          />
        </label>
        <div className="sc-controls-row">
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
              onClick={() => {
                const doSearch = () => run(fetchMosquesNearMe());
                lastSearchRef.current = doSearch;
                doSearch();
              }}
              disabled={loading}
            >
              <MapPin size={15} /> Near {profileCity}
            </button>
          )}
        </div>
      </div>

      {error && canRetry && !loading && (
        <p>
          <button className="outline-button" onClick={() => lastSearchRef.current?.()}>
            Try again · Dobara koshish karein
          </button>
        </p>
      )}

      {loading && <p className="empty-note">Searching OpenStreetMap… this can take up to 30 seconds when OpenStreetMap is slow.</p>}

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
            <div className="acard">
              <ul className="mosque-list">
                {result.mosques.map((mosque) => (
                  <li key={mosque.id} className="srow">
                    <span className="snum2">🕌</span>
                    <div>
                      <strong>{mosque.name}</strong>
                      <small>
                        {mosque.address ? mosque.address : 'Address not listed in OpenStreetMap'}
                      </small>
                      {mosque.phone && (
                        <small>
                          <Phone size={12} /> {mosque.phone}
                        </small>
                      )}
                      {mosque.website && (
                        <small>
                          <a href={mosque.website} target="_blank" rel="noreferrer">
                            Website
                          </a>
                        </small>
                      )}
                    </div>
                    <span className="sc-mosque-right">
                      <b>{mosque.distanceKm} km</b>
                      <a
                        className="sbtn pk"
                        href={mosque.directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Directions →
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="acard">
        <p className="mut">
          Location ki permission doge to list doori ke hisab se khud sort ho jayegi.
          Permission nahi dena to city likh kar bhi search ho jata hai — koi zabardasti nahi.
        </p>
      </div>
    </section>
  );
}
