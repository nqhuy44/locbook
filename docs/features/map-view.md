# Feature: Map View

## 1. Overview
The Map View provides a geospatial visualization of places, allowing users to discover spots based on their physical location or a specific area of interest.

## 2. Architecture
- **Frontend**: `apps/dashboard/src/components/MapView.jsx`
- **Library**: `react-leaflet` (Leaflet.js)
- **Data Source**: Places API.

## 3. Functionality
- **Display**: Shows pin markers for each place on an interactive map.
- **Popup**: Clicking a marker shows a summary card (Name, Rating, Image).
- **Navigation**: "Get Directions" links to Google Maps.
- **Filtering**: The map updates to reflect the filters applied in the main view (e.g., only show "Cafes").

## 4. Technical Implementation
- **Map Tiles**: Uses OpenStreetMap (OSM) tiles for free, open-source mapping.
- **Custom Markers**: Uses custom icons to represent different categories (e.g., Coffee Cup for Cafe, Beer for Bar).
- **Responsiveness**: Analyzes screen size to adjust map zoom and center.
