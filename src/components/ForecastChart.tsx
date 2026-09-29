import { useId, useState } from 'react';
import { CloudRain, Waves } from 'lucide-react';
import { formatDay, formatTime, riskFor } from '../../shared/model';
import type { Hour, Preferences } from '../../shared/types';

export default function ForecastChart({ hours, preferences, mode = 'combined', compact = false }: { hours: Hour[]; preferences: Preferences; mode?: 'combined' | 'tides' | 'rain'; compact?: boolean }) {
  const id = useId().replaceAll(':', '');
  const [hover, setHover] = useState<number | null>(null);
  const width = 900, height = compact ? 150 : 245, left = 39, right = 40, top = 24, bottom = 36;
  const plotW = width - left - right, plotH = height - top - bottom;
  const maxTide = Math.max(3.5, preferences.tideThreshold + 0.5, ...hours.map(h => h.tide ?? 0));
  const maxRain = Math.max(0.1, ...hours.map(h => h.rain ?? 0)) * 1.25;
  const x = (i: number) => left + i / Math.max(1, hours.length - 1) * plotW;
  const y = (value: number) => top + plotH - value / maxTide * plotH;
  const tideGroups: { points: string; first: number; last: number }[] = [];
  hours.forEach((h, i) => {
    if (h.tide === null) return;
    const prior = tideGroups.at(-1);
    if (prior && prior.last === i - 1) { prior.points += ` L${x(i).toFixed(2)},${y(h.tide).toFixed(2)}`; prior.last = i; }
    else tideGroups.push({ points: `M${x(i).toFixed(2)},${y(h.tide).toFixed(2)}`, first: i, last: i });
  });
  const active = hover !== null ? hours[hover] : null;
  return <div className="forecast-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode === 'rain' ? 'Rainfall' : 'Tide and rainfall'} forecast. Tide heights in feet above MLLW; rainfall in inches. The tide curve is interpolated between NOAA high and low predictions.`} onPointerMove={e => { const box = e.currentTarget.getBoundingClientRect(); const cursorX = (e.clientX - box.left) / box.width * width; setHover(Math.max(0, Math.min(hours.length - 1, Math.round((cursorX - left) / plotW * (hours.length - 1))))); }} onPointerLeave={() => setHover(null)}>
      <defs><linearGradient id={`tide-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69b2a1" stopOpacity="0.26"/><stop offset="100%" stopColor="#69b2a1" stopOpacity="0.025"/></linearGradient></defs>
      {[0, 1, 2, 3].map(v => <g key={v}><line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="#edf0ee" strokeDasharray={v ? '3 4' : undefined}/><text x={left - 11} y={y(v) + 4} textAnchor="end" className="chart-label">{mode === 'rain' ? (v / 3 * maxRain).toFixed(2) : `${v.toFixed(1)}`}</text></g>)}
      {mode !== 'rain' && <><line x1={left} x2={width - right} y1={y(preferences.tideThreshold)} y2={y(preferences.tideThreshold)} stroke="#d7b874" strokeDasharray="5 5"/><rect x={left + 8} y={y(preferences.tideThreshold) - 18} width="145" height="16" rx="4" fill="#fff"/><text x={left + 15} y={y(preferences.tideThreshold) - 6} fill="#af8c41" fontSize="10">Planning threshold · {preferences.tideThreshold.toFixed(1)} ft</text></>}
      {mode !== 'tides' && hours.map((h, i) => h.rain !== null && h.rain > 0 ? <rect key={h.time} x={x(i) - plotW / hours.length * 0.28} y={top + plotH - h.rain / maxRain * plotH} width={Math.max(2, plotW / hours.length * 0.56)} height={h.rain / maxRain * plotH} rx="3" fill="#a9bcdc" opacity="0.65"/> : null)}
      {mode !== 'rain' && tideGroups.map((g, i) => <g key={i}><path d={`${g.points} L${x(g.last)},${y(0)} L${x(g.first)},${y(0)} Z`} fill={`url(#tide-${id})`}/><path d={g.points} fill="none" stroke="#428b77" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/></g>)}
      {hours.filter((_, i) => i % Math.max(1, Math.ceil(hours.length / 7)) === 0).map(h => { const i = hours.indexOf(h); return <text key={h.time} x={x(i)} y={height - 9} textAnchor="middle" className="chart-label">{hours.length > 48 ? formatDay(h.time, { weekday: 'short' }) : formatTime(h.time, false).toLowerCase()}</text>; })}
      {!compact && <><text x="10" y="12" className="chart-unit">{mode === 'rain' ? 'in' : 'ft'}</text>{mode === 'combined' && <><text x={width - 17} y="12" className="chart-unit">in</text>{[0, 0.5, 1].map(f => <text key={f} x={width - right + 12} y={top + plotH - f * plotH + 4} className="chart-label">{(f * maxRain).toFixed(2)}</text>)}</>}</>}
      {active && hover !== null && <g><line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotH} stroke="#718c80" strokeDasharray="3 3"/>{active.tide !== null && mode !== 'rain' && <circle cx={x(hover)} cy={y(active.tide)} r="5" fill="#357d68" stroke="white" strokeWidth="2"/>}</g>}
    </svg>
    {active && <div className="chart-tooltip"><b>{formatDay(active.time)} · {formatTime(active.time)}</b><span><Waves size={13}/>{active.tide?.toFixed(2) ?? '—'} ft <CloudRain size={13}/>{active.rain?.toFixed(3) ?? '—'} in · {active.chance ?? '—'}% chance</span><small>{riskFor(active, preferences)} overlap potential</small></div>}
    {!hours.length && <div className="chart-empty">No forecast data for this period.</div>}
  </div>;
}
