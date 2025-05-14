'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import { Icon } from 'leaflet';

const position: LatLngExpression = [1.3745593569267218, 103.88281124897372];

const customIcon = new Icon({
    iconSize: [35, 35],
    iconUrl: 'https://cdn-icons-png.flaticon.com/128/2377/2377922.png',
    iconAnchor: [17, 35],
})

export default function myMap() {
  return (
    <MapContainer
      center={position}
      zoom={13}
      scrollWheelZoom={true}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer 
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <Marker position={position} icon={customIcon}>
        <Popup>
          A pretty CSS3 popup. <br /> Easily customizable.
          <img src="https://cdn-icons-png.flaticon.com/128/2377/2377922.png" alt="pin" />
        </Popup>
      </Marker>
    </MapContainer>
  );
}
