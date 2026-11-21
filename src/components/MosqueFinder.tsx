import { useRef, useState } from 'react';
import { Compass, MapPin, Navigation, Phone, Search } from 'lucide-react';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';
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
  language,
}: {
  onNotify: (message: string) => void;
  guestMode: boolean;
  profileCity: string;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
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
        onNotify(s.mosques.noneFound);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : s.mosques.searchFailed);
      setCanRetry(lastSearchRef.current !== null);
    } finally {
      setLoading(false);
    }
  }

  function searchCity() {
    if (!city.trim()) {
      onNotify(s.mosques.enterCity);
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
      onNotify(s.mosques.noGeolocation);
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
        onNotify(s.mosques.locationDenied);
      },
      { timeout: 15000 },
    );
  }

  return (
    <section className="sc-mosque">
      <div className="quran-browser-head">
        <div>
          <span className="eyebrow">{s.mosques.eyebrow}</span>
          <h3>{s.mosques.title}</h3>
          <p>{s.mosques.intro}</p>
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
            placeholder={s.mosques.searchPlaceholder}
            aria-label={s.mosques.searchAria}
            onKeyDown={(event) => {
              if (event.key === 'Enter') searchCity();
            }}
          />
        </label>
        <div className="sc-controls-row">
          <label className="field-label">
            {s.mosques.radius}
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
            {s.mosques.search}
          </button>
          <button className="outline-button" onClick={useMyLocation} disabled={loading || locating}>
            <Navigation size={15} /> {locating ? s.mosques.locating : s.mosques.useMyLocation}
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
              <MapPin size={15} /> {s.mosques.nearCity(profileCity)}
            </button>
          )}
        </div>
      </div>

      {error && canRetry && !loading && (
        <p>
          <button className="outline-button" onClick={() => lastSearchRef.current?.()}>
            {s.mosques.retry}
          </button>
        </p>
      )}

      {loading && <p className="empty-note">{s.mosques.searching}</p>}

      {result && !loading && (
        <>
          <p className="quran-source-line">
            Source: {result.source}
            {result.place ? ` · ${result.place}` : ''}
            {result.note ? ` · ${result.note}` : ''}
          </p>
          {result.mosques.length === 0 ? (
            <p className="empty-note">
              {s.mosques.noneInRadius(result.radiusKm)}
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
                        {mosque.address ? mosque.address : '{s.mosques.noAddress}'}
                      </small>
                      {mosque.phone && (
                        <small>
                          <Phone size={12} /> {mosque.phone}
                        </small>
                      )}
                      {mosque.website && (
                        <small>
                          <a href={mosque.website} target="_blank" rel="noreferrer">
                            {s.mosques.website}
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
                        {s.mosques.directions}
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
          {s.mosques.footerNote}
        </p>
      </div>
    </section>
  );
}
