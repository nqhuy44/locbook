# Feature: Map View

> **PRD Reference**: FR-10 (Smart Filters), Phase 4 UX
> **Status**: ✅ Working (Basic)
> **Source**: `apps/dashboard/src/components/MapView.jsx`

---

## Overview

The Map View renders places as pins on an interactive map using **Leaflet** (via `react-leaflet`). Users can explore geographically, click pins to see place info, and toggle between List and Map views.

---

## Current Implementation

### Component: `MapView.jsx`

**Features**:
- Renders all visible places as map markers.
- Click marker → popup with place name, vibes, rating.
- "View Details" button in popup → opens Place Detail modal.
- Default center: Ho Chi Minh City (10.78, 106.70).
- Tile provider: OpenStreetMap.

**Data Flow**:
```
App.jsx (places state)
    ↓ filtered places
MapView (react-leaflet)
    ↓ markers
User clicks → openModal(place)
```

### Dependencies
| Package | Purpose |
| :--- | :--- |
| `leaflet` | Map rendering engine |
| `react-leaflet` | React bindings for Leaflet |

### Config Flag
`ENABLE_MAP`: Toggle map view visibility in `AppConfig.FEATURES`.

---

## Place Coordinates

Places store coordinates in two formats:

| Format | Column | Purpose |
| :--- | :--- | :--- |
| Simple floats | `latitude`, `longitude` | Frontend map rendering (fast read) |
| PostGIS Geometry | `location` (POINT, SRID 4326) | Backend spatial queries (geo-search) |

**Important**: These must be kept in sync. When a place is created/updated with coordinates, both formats should be set.

---

## Future Enhancements (PRD 2.0 — Phase 4)

### Custom Map Pins
- [ ] Category-based pin icons (☕ Cafe, 🍺 Bar, 🍽️ Restaurant).
- [ ] Pin color by price level.

### Cluster Markers
- [ ] Group nearby pins when zoomed out (Leaflet MarkerCluster).

### User Location
- [ ] "Show my location" button with GPS.
- [ ] "Places near me" filter (combine with PostGIS query).

### Map-based Discovery
- [ ] Load places dynamically as user pans/zooms (viewport-based query).
- [ ] Highlight "trending" places with animation/glow.

### Map Provider Upgrade
- [ ] Consider Mapbox GL JS for better styling and performance.
- [ ] Custom map theme (dark mode to match dashboard).
