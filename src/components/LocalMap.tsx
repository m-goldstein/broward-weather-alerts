import { useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LocalMap() {
  const container = useRef<HTMLDivElement>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const [mapError, setMapError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false, minZoom: 11, maxZoom: 19, maxBounds: [[25.94, -80.22], [26.10, -80.06]], maxBoundsViscosity: 1 });
    let tileFailures = 0;
    const tiles = L.tileLayer(`/api/basemap?z={z}&x={x}&y={y}&retina=${L.Browser.retina ? '1' : '0'}`, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>', minZoom: 11, maxZoom: 19 });
    tiles.on('loading', () => { tileFailures = 0; });
    tiles.on('tileerror', () => { tileFailures++; });
    tiles.on('load', () => { setMapError(tileFailures > 0); });
    tiles.addTo(map);
    tileLayer.current = tiles;
    map.fitBounds([[26.006, -80.138], [26.047, -80.105]], { padding: [30, 30], maxZoom: 13 });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const icon = (name: string, station: boolean) => L.divIcon({ className: 'map-pin', html: `<span class="pin-dot ${station ? 'station' : ''}"></span><span class="pin-label">${name}</span>`, iconSize: [180, 32], iconAnchor: [9, 9] });
    L.marker([26.011, -80.118], { icon: icon('33019 forecast point', false) }).addTo(map).bindPopup('Weather forecast point for Hollywood Beach, ZIP 33019. Forecasts represent a grid area, not an individual property.');
    L.marker([26.04, -80.115], { icon: icon('NOAA tide station', true) }).addTo(map).bindPopup('Hollywood Beach · NOAA 8722979. Predicted tides only; this is not an operating water-level sensor.');
    L.circle([26.011, -80.118], { radius: 1000, color: '#508d77', weight: 1, fillColor: '#76ac8d', fillOpacity: 0.09, dashArray: '4 5' }).addTo(map).bindPopup('Illustrative 1 km radius around the forecast point. This is not a ZIP boundary or a flood extent.');
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); tiles.off(); tileLayer.current = null; map.remove(); };
  }, []);
  return <div className="local-map-shell"><div className="local-map" ref={container} aria-label="Map of the Hollywood Beach weather forecast point and NOAA tide prediction station"/>{mapError && <div className="map-error" role="status"><MapPin size={17}/><span><b>Some map tiles couldn’t load</b><small>Tide and rainfall forecasts are still available.</small></span><button onClick={() => { setMapError(false); tileLayer.current?.redraw(); }} aria-label="Retry loading map tiles"><RefreshCw size={14}/></button></div>}</div>;
}
