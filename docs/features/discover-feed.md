# Feature: Discover Feed

## 1. Overview
The Discover Feed is the landing page of LocBook, presenting a curated list of places. It serves as the primary interface for browsing and filtering.

## 2. Architecture
- **Frontend**: `apps/dashboard/src/App.jsx` + `CategoryRow.jsx`.
- **API**: `GET /api/places`.

## 3. Functionality
- **Feed**: Displays a vertical scroll of Place Cards.
- **Search Bar**: Allows natural language queries (powered by AI).
- **Filters**: Quick toggles for categories (Cafe, Bar, Restaurant).
- **Pagination**: Infinite scroll or "Load More" to browse the database.

## 4. Logic Flow
1. **Initial Load**: Fetches the latest/trending places.
2. **User Filter**: Clicking "Cafe" triggers a new API request with `category=Cafe`.
3. **AI Search**: Typing a query sends it to `/api/chat`. The AI returns a list of matching IDs or a filter config, which updates the feed.
