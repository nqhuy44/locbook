import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapPin, Navigation, Crosshair } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_URL } from '../utils/config';

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


const MapView = ({ places, onPlaceClick }) => {
    // Default center (HCMC)
    const [center, setCenter] = useState([10.762622, 106.660172]);
    const [userLocation, setUserLocation] = useState(null);
    const [zoom, setZoom] = useState(15);

    // Get User Location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => { // Made the callback async to use await
                    const { latitude, longitude } = position.coords;
                    const pos = [latitude, longitude];
                    setUserLocation(pos);
                    // We let MapController handle the flyTo
                    try {
                        // Fetch recommended places
                        // Note: 'query' needs to be defined or passed if this search is intended to be dynamic.
                        // For now, assuming 'query' is an empty string or defined elsewhere.
                        const response = await fetch(`${API_URL}/api/discovery/search?q=${encodeURIComponent(query)}`);
                        const data = await response.json();

                        if (data && data.length > 0) {
                            setSuggestedPlaces(data);
                        }
                    } catch (err) {
                        console.error("Error searching places:", err);
                    }
                },
                (error) => {
                    console.log("Error getting location: ", error);
                }
            );
        }
    }, [query]); // Added query to dependency array if it's meant to trigger a re-fetch

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
                {/* CartoDB Positron Tiles for Light Theme */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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

                                    {/* Thumbnail Image */}
                                    {place.local_image_path && (
                                        <div style={{ width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                                            <img
                                                src={`${API_URL}/images/${place.local_image_path}`}
                                                alt={place.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}

                                    <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#666', whiteSpace: 'pre-wrap' }}>{place.address}</p>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                        {place.vibes?.slice(0, 3).map(v => (
                                            <span key={v} style={{ fontSize: '0.7rem', background: '#fce7f3', padding: '2px 6px', borderRadius: '4px', color: '#db2777' }}>{v}</span>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <button
                                            onClick={() => onPlaceClick(place)}
                                            style={{
                                                flex: 1,
                                                background: '#d946ef',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                fontWeight: '600'
                                            }}
                                        >
                                            View Details
                                        </button>
                                        {place.google_maps_url && (
                                            <a href={place.google_maps_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px', background: '#f3e8ff', color: '#7e22ce', textDecoration: 'none' }} title="Get Directions">
                                                <Navigation size={16} />
                                            </a>
                                        )}
                                    </div>
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
