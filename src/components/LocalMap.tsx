import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LocalMap() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false }).setView([26.022, -80.127], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>', maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const icon = (name: string, station: boolean) => L.divIcon({ className: 'map-pin', html: `<span class="pin-dot ${station ? 'station' : ''}"></span><span class="pin-label">${name}</span>`, iconSize: [180, 32], iconAnchor: [9, 9] });
    L.marker([26.011, -80.118], { icon: icon('33019 forecast point', false) }).addTo(map).bindPopup('Weather forecast point for Hollywood Beach, ZIP 33019. Forecasts represent a grid area, not an individual property.');
    L.marker([26.04, -80.115], { icon: icon('NOAA tide station', true) }).addTo(map).bindPopup('Hollywood Beach · NOAA 8722979. Predicted tides only; this is not an operating water-level sensor.');
    L.circle([26.011, -80.118], { radius: 1000, color: '#508d77', weight: 1, fillColor: '#76ac8d', fillOpacity: 0.09, dashArray: '4 5' }).addTo(map).bindPopup('Illustrative 1 km radius around the forecast point. This is not a ZIP boundary or a flood extent.');
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, []);
  return <div className="local-map" ref={container} aria-label="Map of the Hollywood Beach weather forecast point and NOAA tide prediction station"/>;
}
