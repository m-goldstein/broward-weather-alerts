import { useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ForecastLocation } from '../../shared/types';

export default function LocalMap({ location }: { location: ForecastLocation }) {
  const container = useRef<HTMLDivElement>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const [mapError, setMapError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false, minZoom: 11, maxZoom: 19, maxBounds: [[location.lat - 0.25, location.lon - 0.25], [location.lat + 0.25, location.lon + 0.25]], maxBoundsViscosity: 1 });
    let tileFailures = 0;
    const tiles = L.tileLayer(`/api/basemap?zip=${location.zip}&z={z}&x={x}&y={y}&retina=${L.Browser.retina ? '1' : '0'}`, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>', minZoom: 11, maxZoom: 19 });
    tiles.on('loading', () => { tileFailures = 0; });
    tiles.on('tileerror', () => { tileFailures++; });
    tiles.on('load', () => { setMapError(tileFailures > 0); });
    tiles.addTo(map);
    tileLayer.current = tiles;
    const bounds = L.latLngBounds([[location.lat - 0.015, location.lon - 0.015], [location.lat + 0.015, location.lon + 0.015]]);
    if (location.stationLat !== null && location.stationLon !== null) bounds.extend([location.stationLat, location.stationLon]);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const icon = (name: string, station: boolean) => {
      const element = document.createElement('div'), dot = document.createElement('span'), label = document.createElement('span');
      dot.className = `pin-dot ${station ? 'station' : ''}`; label.className = 'pin-label'; label.textContent = name;
      element.append(dot, label);
      return L.divIcon({ className: 'map-pin', html: element, iconSize: [180, 32], iconAnchor: [9, 9] });
    };
    const popup = (text: string) => { const element = document.createElement('div'); element.textContent = text; return element; };
    L.marker([location.lat, location.lon], { icon: icon(`${location.zip} forecast point`, false) }).addTo(map).bindPopup(popup(`Weather forecast point for ${location.name}, ZIP ${location.zip}. Forecasts represent a grid area, not an individual property.`));
    if (location.stationLat !== null && location.stationLon !== null) L.marker([location.stationLat, location.stationLon], { icon: icon('NOAA tide station', true) }).addTo(map).bindPopup(popup(`${location.stationName} · NOAA ${location.station}. Predicted tides only; this is not an operating water-level sensor.`));
    L.circle([location.lat, location.lon], { radius: 1000, color: '#2563b8', weight: 1, fillColor: '#3480cf', fillOpacity: 0.09, dashArray: '4 5' }).addTo(map).bindPopup('Illustrative 1 km radius around the forecast point. This is not a ZIP boundary or a flood extent.');
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); tiles.off(); tileLayer.current = null; map.remove(); };
  }, [location]);
  return <div className="local-map-shell"><div className="local-map" ref={container} aria-label={`Map of the ${location.name} weather forecast point${location.station ? ' and NOAA tide prediction station' : ''}`}/>{mapError && <div className="map-error" role="status"><MapPin size={17}/><span><b>Some map tiles couldn’t load</b><small>Tide and rainfall forecasts are still available.</small></span><button onClick={() => { setMapError(false); tileLayer.current?.redraw(); }} aria-label="Retry loading map tiles"><RefreshCw size={14}/></button></div>}</div>;
}
