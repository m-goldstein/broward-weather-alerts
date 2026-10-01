import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CloudRain, RefreshCw, TriangleAlert, Waves } from 'lucide-react';
import { assessFloodCheck, DAY, easternDateTimeToIso, easternDateTimeValue, HOUR, MAX_LOOKAHEAD_DAYS, RAIN_HOURLY_TRIGGER, RAIN_THREE_HOUR_TRIGGER } from '../../shared/flood-check';
import type { HazardSignal } from '../../shared/flood-check';
import type { FloodCheckData } from '../../shared/types';
import { useLanguage } from '../LanguageContext';
import { readPreferences } from '../preferences';

const signalNames: Record<HazardSignal, string> = { possible: 'Potential hazard', 'no-signal': 'Below screening threshold', unknown: 'Incomplete data' };

export default function FloodCheck({ zip: initialZip, activeTideThreshold }: { zip: string; activeTideThreshold: number }) {
  const { t, formatDay, formatTime } = useLanguage();
  const [zip, setZip] = useState(initialZip);
  const [dateTime, setDateTime] = useState(() => easternDateTimeValue(new Date(Math.ceil(Date.now() / HOUR) * HOUR + HOUR)));
  const [data, setData] = useState<FloodCheckData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  function clearResult() {
    controllerRef.current?.abort(); controllerRef.current = null;
    setData(null); setError(''); setLoading(false);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); clearResult();
    const selectedZip = zip.trim();
    if (!/^\d{5}$/.test(selectedZip)) { setError('Enter a valid five-digit US ZIP code.'); return; }
    let at: string;
    try { at = easternDateTimeToIso(dateTime); } catch (e) { setError(e instanceof Error ? e.message : 'Enter a valid date and time.'); return; }
    if (Date.parse(at) <= Date.now()) { setError('Choose a future date and time. Historical flood forecasts are not available.'); return; }
    if (Date.parse(at) > Date.now() + MAX_LOOKAHEAD_DAYS * DAY) { setError('Choose a date within the next 365 days.'); return; }
    const controller = new AbortController(); controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 65000);
    setLoading(true);
    try {
      const response = await fetch(`/api/flood-check?${new URLSearchParams({ zip: selectedZip, at })}`, { signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to check the flood outlook. Please try again shortly.');
      if (controllerRef.current !== controller) return;
      if (result.location?.zip !== selectedZip || result.requestedAt !== at) throw new Error('The forecast location or time could not be confirmed. Please try again.');
      setData(result as FloodCheckData);
    } catch (e) {
      if (controllerRef.current === controller) setError(controller.signal.aborted ? 'The forecast request timed out. Please try again.' : e instanceof Error ? e.message : 'Unable to connect to the forecast service.');
    } finally {
      clearTimeout(timeout);
      if (controllerRef.current === controller) { setLoading(false); controllerRef.current = null; }
    }
  }

  const tideThreshold = data?.location.zip === initialZip ? activeTideThreshold : data ? readPreferences(data.location.zip).tideThreshold : activeTideThreshold;
  const risk = data ? assessFloodCheck(data, tideThreshold) : null;
  const dateLabel = (time: string) => `${formatDay(time, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${formatTime(time)}`;
  return <section className="panel flood-check" aria-labelledby="flood-check-title">
    <div className="panel-heading"><div><h2 id="flood-check-title">{t('Check flooding for a date & time')}</h2><p>{t('Enter a ZIP and a future time to check rain, high tide, and potential flooding.')}</p></div><span className="icon-surface"><Waves size={20} aria-hidden="true"/></span></div>
    <form className="flood-check-form" onSubmit={submit} noValidate aria-busy={loading}>
      <label htmlFor="flood-zip">{t('ZIP code')}<input id="flood-zip" name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip} onChange={event => { clearResult(); setZip(event.target.value); }} aria-describedby="flood-check-help"/></label>
      <label htmlFor="flood-time">{t('Date & time (Eastern)')}<input id="flood-time" name="dateTime" type="datetime-local" step="60" value={dateTime} onChange={event => { clearResult(); setDateTime(event.target.value); }} aria-describedby="flood-check-help"/></label>
      <button className="button primary" type="submit" disabled={loading}>{loading ? <RefreshCw size={17} className="spin" aria-hidden="true"/> : <ArrowRight size={17} aria-hidden="true"/>}{loading ? t('Checking…') : t('Check flood outlook')}</button>
    </form>
    <p id="flood-check-help" className="flood-check-help">{t('All times Eastern (America/New_York). Check up to 365 days ahead; rain forecasts generally cover the next 7 days.')}</p>
    {error && <p className="flood-check-error" role="alert">{t(error)}</p>}
    {loading && <p className="flood-check-help" role="status">{t('Checking NOAA tides and National Weather Service rainfall…')}</p>}
    {data && risk && <div className="flood-check-result" role="status" aria-live="polite" aria-atomic="true">
      <div className={`flood-verdict ${risk.overall}`}><TriangleAlert size={23} aria-hidden="true"/><div><h3>{t(risk.overall === 'possible' ? 'Flooding may be possible' : risk.overall === 'unknown' ? 'Not enough data to assess flooding' : 'No flood signal in the available forecast')}</h3><p>{data.location.name} · ZIP {data.location.zip}<br/>{dateLabel(data.requestedAt)} {t('Eastern')}</p></div></div>
      {risk.incomplete && <p className="flood-incomplete">{t('Assessment incomplete: a known hazard can still be flagged, but missing data cannot rule out flooding.')}</p>}
      <div className="flood-values">
        <div><Waves size={20} aria-hidden="true"/><h4>{t('Estimated tide at this time')}</h4><b>{data.tide === null ? t('Unavailable') : `${data.tide.toFixed(2)} ft MLLW`}</b><span>{t(signalNames[risk.tide])}</span><p>{data.nearbyHighTide ? t('Nearest high tide: {height} ft at {time}', { height: data.nearbyHighTide.height.toFixed(2), time: dateLabel(data.nearbyHighTide.time) }) : t('No nearby high tide prediction available.')}</p></div>
        <div><CloudRain size={20} aria-hidden="true"/><h4>{t('Rain in the selected hour')}</h4><b>{data.rain === null ? t('Unavailable') : `${data.rain.toFixed(2)} in`}</b><span>{t('Rain chance: {chance}', { chance: data.chance === null ? t('Unavailable') : `${data.chance}%` })}</span><p>{t('Hour beginning {time} Eastern. Rain amounts are averaged across NWS forecast intervals.', { time: formatTime(data.rainStartsAt) })}</p></div>
        <div><CloudRain size={20} aria-hidden="true"/><h4>{t('Rain over 3 hours')}</h4><b>{data.rainThreeHours === null ? t('Unavailable') : `${data.rainThreeHours.toFixed(2)} in`}</b><span>{t(signalNames[risk.rain])}</span><p>{t('From the selected hour through the following 2 hours.')}</p></div>
      </div>
      <dl className="flood-signals"><div><dt>{t('High-tide hazard')}</dt><dd className={risk.tide}>{t(signalNames[risk.tide])}</dd></div><div><dt>{t('Heavy-rain hazard')}</dt><dd className={risk.rain}>{t(signalNames[risk.rain])}</dd></div><div><dt>{t('Rain & tide together')}</dt><dd className={risk.overlap}>{t(signalNames[risk.overlap])}</dd></div></dl>
      {data.weatherAvailability !== 'available' && <p className="flood-incomplete">{t(data.weatherAvailability === 'outside-forecast' ? 'This time is beyond the rain forecast. Tide predictions are shown when available; check again closer to the date.' : 'Rain forecasts do not cover this time or are unavailable. Check again later.')}</p>}
      {data.weatherCoverageEndsAt && <p>{t('Available rain forecast ends: {time} Eastern.', { time: dateLabel(data.weatherCoverageEndsAt) })}</p>}
      <p>{data.location.station ? t('Tide reference: {stationName} · NOAA {station} · {distance} km from the ZIP point. Local waterways may differ.', { stationName: data.location.stationName ?? '', station: data.location.station, distance: data.location.stationDistanceKm ?? '—' }) : t('No NOAA tide prediction station within 25 km. Rainfall forecasts remain available; tide overlap is incomplete.')}</p>
      <p>{t('Screening thresholds: tide ≥ {tide} ft MLLW; rain ≥ {hourly} in in an hour or ≥ {threeHours} in over 3 hours. Rain chance is not flood probability.', { tide: tideThreshold.toFixed(2), hourly: RAIN_HOURLY_TRIGGER, threeHours: RAIN_THREE_HOUR_TRIGGER })}</p>
      <p>{t('Tide heights are estimated between NOAA high/low predictions.')}</p>
      <p>{t('These planning thresholds are not official flood levels. ZIP forecasts and astronomical tides cannot predict flooding at a property or account for drainage, elevation, or storm surge.')}</p>
      <div className="flood-sources">{Object.entries(data.sources).map(([key, source]) => <span key={key}>{t(key === 'tides' ? 'Tides' : 'Weather')}: {t(source.status)}{source.fetchedAt && ` · ${t('Fetched')} ${dateLabel(source.fetchedAt)}`}{source.issuedAt && ` · ${t('Issued')} ${dateLabel(source.issuedAt)}`}</span>)}</div>
      {data.sources.weather.status === 'cached' && <p className="flood-incomplete">{t('Rain data is cached. Displayed values may be outdated; the rain hazard assessment remains incomplete.')}</p>}
      <a className="text-button" href={`https://forecast.weather.gov/MapClick.php?lat=${data.location.lat}&lon=${data.location.lon}`} target="_blank" rel="noreferrer">{t('Check official NWS forecasts & warnings')} <ArrowRight size={14} aria-hidden="true"/></a>
    </div>}
  </section>;
}
