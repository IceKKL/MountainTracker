import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Props {
  track: [number, number][];
  hoveredPoint?: [number, number] | null;
}

function FitBounds({ track }: { track: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (track.length < 2) return;
    const bounds = L.latLngBounds(track.map(([lat, lon]) => [lat, lon]));
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, track]);
  return null;
}

export default function TripMap({ track, hoveredPoint = null }: Props) {
  if (track.length < 2) return null;

  const center = track[Math.floor(track.length / 2)];

  return (
    <div className="route-map">
      <MapContainer
        center={[center[0], center[1]]}
        zoom={12}
        scrollWheelZoom
        className="route-map-inner"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={track.map(([lat, lon]) => [lat, lon])} color="#c45c3a" weight={4} />
        {hoveredPoint && (
          <CircleMarker
            center={hoveredPoint}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#4a6741',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}
        <FitBounds track={track} />
      </MapContainer>
    </div>
  );
}
