import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
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
  lat?: number | null;
  lon?: number | null;
  track?: [number, number][] | null;
}

function FitBounds({ track }: { track: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (track.length < 2) return;
    const bounds = L.latLngBounds(track.map(([lat, lon]) => [lat, lon]));
    map.fitBounds(bounds, { padding: [6, 6] });
  }, [map, track]);
  return null;
}

export default function TripCardMap({ lat, lon, track }: Props) {
  const hasTrack = !!track && track.length >= 2;
  const hasPoint = lat != null && lon != null;

  if (!hasTrack && !hasPoint) return null;

  const center: [number, number] = hasTrack
    ? track[Math.floor(track.length / 2)]
    : [lat!, lon!];

  return (
    <div className="trip-card-map" aria-hidden="true">
      <MapContainer
        center={center}
        zoom={11}
        className="trip-card-map-inner"
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {hasTrack ? (
          <>
            <Polyline
              positions={track.map(([tLat, tLon]) => [tLat, tLon])}
              color="#c45c3a"
              weight={3}
            />
            <FitBounds track={track} />
          </>
        ) : (
          <Marker position={[lat!, lon!]} />
        )}
      </MapContainer>
    </div>
  );
}
