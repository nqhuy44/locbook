# Feature: Google Maps Integration

> **PRD Reference**: FR-02, Phase 2.2
> **Status**: ✅ Working (Basic), 🔧 Deep integration planned
> **Source**: `src/core/parser.py`

---

## Overview

The **LinkParser** is responsible for extracting rich place data from Google Maps URLs. When a user sends a Google Maps link to the Telegram bot, the parser resolves the URL, calls the Google Places API (New), fetches photos, scrapes additional data, and combines everything for AI analysis.

---

## Architecture

```
Google Maps URL (from user)
    ↓
LinkParser.extract_url() → Validate & resolve short URLs
    ↓
LinkParser.fetch_place_info()
    ├── _call_places_api() → Google Places API (New) Text Search
    │       ↓
    │   Returns: name, address, rating, opening_hours, reviews, photos
    │       ↓
    ├── _fetch_photo_bytes() → Download up to 5 photos
    │       ↓
    └── Fallback: BeautifulSoup scraping if API fails
    ↓
Combined data → ai_service.analyze_place_complex(text, images)
    ↓
Structured Place + Marin Commentary
```

---

## API Integration

### Google Places API (New)

**Endpoint**: `https://places.googleapis.com/v1/places:searchText`

**Field Mask** (requested data):
```
places.displayName,
places.formattedAddress,
places.location,
places.rating,
places.regularOpeningHours,
places.photos,
places.reviews,
places.googleMapsUri,
places.priceLevel,
places.userRatingCount,
places.websiteUri
```

**Headers**:
```
X-Goog-Api-Key: {GOOGLE_PLACES_API_KEY}
X-Goog-FieldMask: {field_mask}
```

### Photo Fetching

**Endpoint**: `https://places.googleapis.com/v1/{photo_name}/media`

**Process**:
1. Places API returns photo references (`places[0].photos[].name`).
2. Up to 5 photos are fetched as bytes.
3. Each photo request specifies `maxWidthPx=800`.
4. Returns `(image_bytes, mime_type)` tuples.

### Geocoding

**Method**: `LinkParser.geocode_place(name, address)`

Used when a place name is extracted from a screenshot (no URL). Calls Places API Text Search with the name + address to get coordinates.

---

## URL Resolution

Google Maps URLs come in many formats:

| Format | Example |
| :--- | :--- |
| Short link | `https://maps.app.goo.gl/abc123` |
| Full URL | `https://www.google.com/maps/place/Cafe+Name/@10.78,106.70,...` |
| Search URL | `https://www.google.com/maps/search/coffee+saigon` |

The parser uses `httpx` to follow redirects and resolve short links to their full form, then extracts the place name from the URL path for API lookup.

---

## Web Scraping Fallback

If the Google Places API key is not configured or fails, the parser falls back to web scraping:

1. Fetch the Google Maps page HTML.
2. Parse with BeautifulSoup.
3. Extract `<title>`, meta descriptions, JSON-LD structured data.
4. Less reliable but functional without API keys.

---

## Review Handling

Reviews from the Places API are included for AI context:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `MAX_REVIEWS_FOR_AI` | 5 | Limit reviews sent to LLM |

Reviews are trimmed to save tokens. The AI uses them to generate vibe tags and mood assessment.

---

## Configuration

| Setting | Required | Description |
| :--- | :--- | :--- |
| `GOOGLE_PLACES_API_KEY` | Optional | Enables Places API. Falls back to scraping. |

---

## Future Enhancements (PRD 2.0 — Phase 2.2)

### Richer Metadata Extraction
- [ ] Extract `priceLevel` from API → map to `$`/`$$`/`$$$`.
- [ ] Parse `regularOpeningHours` → structured format for "Open Now" filter.
- [ ] Extract `popularTimes` (requires Places API Advanced).
- [ ] Fetch user review summaries for AI context.

### Menu from Google Maps
- [ ] Detect menu photos in Places API photo list.
- [ ] Send menu photos to Gemini Vision for OCR.
- [ ] Auto-populate `Place.menu` JSONB.

### Duplicate Detection
- [ ] Before processing a link, check `google_maps_url` in DB.
- [ ] If exists → show existing place instead of re-processing.
- [ ] Save API tokens and processing time.
