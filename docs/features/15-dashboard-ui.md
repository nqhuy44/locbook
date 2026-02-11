# Feature: Dashboard UI (User Frontend)

> **PRD Reference**: Phase 4 UX/UI
> **Status**: ✅ Working (Core), 🔧 Redesign planned
> **Source**: `apps/dashboard/src/`

---

## Overview

The **User Dashboard** is a React + Vite single-page application. It's the public-facing interface where users browse, search, and explore places. Built with a mobile-first approach, it features a card-based layout, category filters, map view, and an AI chat widget.

---

## Tech Stack

| Technology | Purpose |
| :--- | :--- |
| React 18 | UI framework |
| Vite | Build tool & dev server |
| Leaflet + react-leaflet | Map rendering |
| Lucide React | Icon library |
| Vanilla CSS | Styling (no Tailwind) |

---

## Component Architecture

```
App.jsx (Main — 618 lines)
├── Search Bar (text input)
├── CategoryRow.jsx (horizontal tag scroller)
├── View Toggle (List / Map / Chat)
├── Place Cards Grid (filtered results)
│   └── PlaceCard({ place, onClick })
├── Place Detail Modal
│   ├── PlaceHeroImage({ place })
│   └── ShareButton()
├── MapView.jsx (Leaflet map)
└── ChatView.jsx (Marin AI conversation)
```

---

## Features

### 1. Search & Filtering

**Text Search**: Filters places by name, address, vibes, categories (client-side).

**Category Filters** (`CategoryRow.jsx`):
- Horizontal scrollable row of tag chips.
- Click to toggle filter. Active filters highlighted.
- Categories from `AppConfig.CATEGORY_SYNONYMS`.

**Vibe Filters**: Similar chip-based filtering by vibe tags.

### 2. Place Cards

Grid layout showing:
- Hero image (first image or placeholder).
- Place name.
- Vibe tags (colored chips).
- Rating (star icon).
- Click → opens detail modal.

### 3. Place Detail Modal

Full-screen overlay with:
- Hero image (full width).
- Name, address, rating.
- Vibe and mood tags.
- Opening hours.
- Google Maps link button.
- Share button (copy link to clipboard).

### 4. Map View (`MapView.jsx`)

- Toggle between List and Map views.
- Leaflet map with place markers.
- Click marker → popup → "View Details" opens modal.
- See [11-map-view.md](./11-map-view.md) for details.

### 5. Chat View (`ChatView.jsx`)

- AI chat interface with Marin.
- Text input → `POST /api/chat`.
- Renders Marin's responses with markdown.
- Shows suggested places as clickable cards.
- Session persistence via `session_id`.
- See [05-ai-chat-marin.md](./05-ai-chat-marin.md) for backend details.

### 6. Share Button (`ShareButton`)

- Copies current page URL to clipboard.
- Toast notification on success.
- Uses `navigator.clipboard.writeText()`.

---

## Dynamic Configuration

Dashboard fetches config from `GET /api/config` on mount:

```javascript
// config.js
export const CONFIG = {
  FEATURES: {
    ENABLE_BUY_ME_COFFEE: true,
    ENABLE_FOOTER: true,
    ENABLE_DISCOVER: true,
    ENABLE_MAP: false,
    FEAT_AI_MATCHMAKE: true,
  },
  CATEGORY_SYNONYMS: { ... },
  MARIN: { ... }
};
```

Feature flags control visibility:
- `ENABLE_MAP` → Show/hide Map tab.
- `ENABLE_DISCOVER` → Show/hide Discovery feed.
- `FEAT_AI_MATCHMAKE` → Show/hide Chat view.

---

## API Integration

| API Call | Trigger | Purpose |
| :--- | :--- | :--- |
| `GET /api/places?limit=100` | On mount | Fetch all places |
| `GET /api/config` | On mount | Load feature flags |
| `POST /api/chat` | Chat submit | Send message to Marin |

---

## Styling (`index.css`)

- **16,680 bytes** of vanilla CSS.
- Dark theme with gradient accents.
- CSS custom properties for theming.
- Responsive breakpoints for mobile/tablet/desktop.
- Glassmorphism effects on cards.
- Smooth transitions and hover effects.

---

## Future Enhancements (PRD 2.0 — Phase 4)

### Place Detail Revamp
- [ ] Tabbed layout: Overview | Menu | Memos.
- [ ] Show `upvote_count` and `memo_count`.
- [ ] "Friends who've been here" avatars.
- [ ] Upvote button (heart with animation).
- [ ] "Save to Collection" dropdown.

### Discovery Feed
- [ ] Pinterest-style masonry layout.
- [ ] Infinite scroll with `offset` pagination.
- [ ] Sort toggle: "Best Match" / "Most Popular" / "Trending".

### Access Control UI
- [ ] Login prompt for restricted actions.
- [ ] "Sign in with Google" button.
- [ ] Graceful degradation for anonymous users.

### Interaction Polish
- [ ] Micro-animations: heart burst (upvote), slide-in (bookmark).
- [ ] Skeleton loading states instead of spinners.
- [ ] Smooth transitions between List ↔ Map ↔ Chat views.
- [ ] Pull-to-refresh on mobile.
