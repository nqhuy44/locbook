# Feature: Google Maps Link Analysis (Telegram)

## 1. Overview
This feature allows users to simply drop a Google Maps link into the Telegram Bot to add a place to LocBook. The system attempts to scrape or fetch details from the link and uses AI to structure the data.

## 2. Architecture
- **Handler**: `apps/api/src/bot/handlers.py` -> `handle_message`
- **Parser**: `src.core.parser.link_parser`
- **AI**: `src.core.llm` (Multimodal analysis if screenshots available)

## 3. Logic Flow
1. **User Action**: Sends a link (e.g., `https://maps.app.goo.gl/...`).
2. **Link Extraction**: API detects the URL.
3. **Fetching**: 
    - The `link_parser` attempts to fetch metadata (Title, Description, Graph Tags) from the URL.
    - If Google Places API is enabled and `cid` is found, it fetches structured data (Reviews, Rating, Hours).
4. **AI Analysis**: 
    - The text content (reviews, description) is sent to Gemini.
    - Gemini extracts structure: `Category`, `Vibe`, `Features`.
5. **Deduplication**: Checks if the URL already exists in DB.
6. **Saving**: Creates a new `Place` record.
7. **Response**: Bot replies with the created Place Card.

## 4. Techniques
- **Heuristics**: Fallback logic if API fails (using regex on the URL to find name).
- **Review Analysis**: Uses recent reviews to infer "Vibe" (e.g., "noisy" -> "Lively").
