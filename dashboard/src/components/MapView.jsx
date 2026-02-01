import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapPin, Navigation, Crosshair } from 'lucide-react';
import { useState, useEffect } from 'react';

// Custom Marker Icon for Places
const createCustomIcon = () => {
    const iconMarkup = renderToStaticMarkup(
        <div style={{ color: '#d946ef', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
            <MapPin size={38} fill="#1a0b2e" strokeWidth={2.5} />
            <div style={{
                width: '8px', height: '8px', background: '#f472b6',
                borderRadius: '50%', position: 'absolute',
                top: '10px', left: '15px', border: '1px solid #1a0b2e'
            }}></div>
        </div>
    );

    return divIcon({
        html: iconMarkup,
        className: 'custom-marker-icon',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
    });
};

// User Location Icon (Blue Dot)
const createUserIcon = () => {
    const iconMarkup = renderToStaticMarkup(
        <div style={{
            width: '16px', height: '16px', background: '#3b82f6',
            borderRadius: '50%', border: '2px solid white',
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)'
        }}></div>
    );

    return divIcon({
        html: iconMarkup,
        className: 'user-marker-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

// Component to handle map fly handling
const MapController = ({ center, zoom, userLocation }) => {
    const map = useMap();

    // Fly to user location on first load if available
    useEffect(() => {
        if (userLocation) {
            map.flyTo(userLocation, 15, { animate: true, duration: 1.5 });
        }
    }, [userLocation, map]);

    return null;
}

const MapView = ({ places }) => {
    // Default center (HCMC)
    const [center, setCenter] = useState([10.762622, 106.660172]);
    const [userLocation, setUserLocation] = useState(null);
    const [zoom, setZoom] = useState(15);

    // Get User Location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const pos = [latitude, longitude];
                    setUserLocation(pos);
                    // We let MapController handle the flyTo
                },
                (error) => {
                    console.log("Error getting location: ", error);
                }
            );
        }
    }, []);

    // Filter valid places (GeoJSON: location.coordinates = [lon, lat])
    // Mongo uses [lon, lat], Leaflet uses [lat, lon]
    const validPlaces = places.filter(p =>
        p.location &&
        p.location.coordinates &&
        p.location.coordinates.length === 2
    );

    return (
        <div style={{ height: 'calc(100vh - 260px)', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
            >
                {/* CartoDB Dark Matter Tiles for a cleaner, darker look that fits Marin theme */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                <MapController center={center} zoom={zoom} userLocation={userLocation} />

                {/* User Marker */}
                {userLocation && (
                    <Marker position={userLocation} icon={createUserIcon()}>
                        <Popup><span>You are here</span></Popup>
                    </Marker>
                )}

                {/* Place Markers */}
                {validPlaces.map(place => {
                    // GeoJSON is [lon, lat] -> Leaflet needs [lat, lon]
                    const [lon, lat] = place.location.coordinates;
                    return (
                        <Marker
                            key={place._id}
                            position={[lat, lon]}
                            icon={createCustomIcon()}
                        >
                            <Popup className="marin-popup">
                                <div style={{ minWidth: '200px' }}>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '600' }}>{place.name}</h3>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#666', whiteSpace: 'pre-wrap' }}>{place.address}</p>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                        {place.vibes?.slice(0, 3).map(v => (
                                            <span key={v} style={{ fontSize: '0.7rem', background: '#fce7f3', padding: '2px 6px', borderRadius: '4px', color: '#db2777' }}>{v}</span>
                                        ))}
                                    </div>
                                    {place.google_maps_url && (
                                        <a href={place.google_maps_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: '#7e22ce', fontSize: '0.8rem', fontWeight: '600' }}>
                                            <Navigation size={12} /> Get Directions
                                        </a>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* Overlay User Location Control */}
            {userLocation && (
                <div
                    style={{
                        position: 'absolute', bottom: '20px', right: '20px',
                        background: 'white', padding: '10px', borderRadius: '50%',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 9999
                    }}
                    onClick={() => {
                        console.log("Focusing user location...");
                    }}
                    title="Your Location"
                >
                    <Crosshair size={24} color="#3b82f6" />
                </div>
            )}
        </div>
    );
};

export default MapView;
