import { useLanguage } from '../LanguageContext';
import { ArrowDown, ArrowUp, CloudRain, Waves } from 'lucide-react';
import { riskFor } from '../../shared/model';
import type { Hour, Preferences, Tide } from '../../shared/types';

const names = { low: 'Low', moderate: 'Elevated', high: 'High', unknown: 'Incomplete' };

export function MobileTideList({ tides, threshold }: { tides: Tide[]; threshold: number }) {
  const { t, formatDay, formatTime, describeWeather } = useLanguage();
  return <div className="mobile-forecast-list tide-list" aria-label={t("Upcoming tides")}>
    {tides.map(tide => <article className="tide-row" key={tide.time}>
      <span className={`tide-row-icon ${tide.type === 'H' ? 'high' : 'low'}`}>{tide.type === 'H' ? <ArrowUp size={20} aria-hidden={"true"}/> : <ArrowDown size={20} aria-hidden={"true"}/>}</span>
      <div><h3>{formatTime(tide.time)} <span>{tide.type === 'H' ? t("High tide") : t("Low tide")}</span></h3><p>{formatDay(tide.time)}</p>{tide.height >= threshold && <small className="threshold-exceeded">{t("Above your")} {threshold.toFixed(1)} {t("ft threshold")}</small>}</div>
      <b className="tide-row-height">{tide.height.toFixed(2)}<small>ft MLLW</small></b>
    </article>)}
    {!tides.length && <p className="empty-text">{t("No tide predictions are available for this period.")}</p>}
  </div>;
}

export function MobileHourlyList({ hours, preferences }: { hours: Hour[]; preferences: Preferences }) {
  const { t, formatDay, formatTime, describeWeather } = useLanguage();
  return <div className="mobile-forecast-list hourly-list" aria-label={t("Hourly rainfall forecast")}>
    {hours.map(hour => { const risk = riskFor(hour, preferences); return <article className="hour-row" key={hour.time}>
      <div className="hour-row-heading"><h3>{formatTime(hour.time)}<span>{formatDay(hour.time, { weekday: 'short' })}</span></h3><span className={`risk-badge ${risk}`}><span/>{names[risk]} {t("overlap")}</span></div>
      <p>{hour.description}</p>
      <dl><div><dt><CloudRain size={15} aria-hidden={"true"}/>{t("Rain chance")}</dt><dd>{hour.chance ?? '—'}%</dd></div><div><dt>{t("Rain amount")}</dt><dd>{hour.rain?.toFixed(3) ?? '—'} <small>in</small></dd></div><div><dt><Waves size={15} aria-hidden={"true"}/>{t("Est. tide")}</dt><dd>{hour.tide?.toFixed(2) ?? '—'} <small>ft</small></dd></div></dl>
    </article>; })}
    {!hours.length && <p className="empty-text">{t("No rainfall forecasts are available for this period.")}</p>}
  </div>;
}
