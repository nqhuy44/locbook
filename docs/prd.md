# LocBook (The Living POI Database)
Version: 1.0 (MVP) Code Name: LocBook Bot Persona: Marin (The Location Scout) Owner: Huy Status: Blueprinting

## 1. Executive Summary
LocBook is a personal, AI-powered Point of Interest (POI) management system designed to cure "bookmark chaos." It transforms static screenshots and Google Maps links into a searchable, "living" database enriched with semantic context (vibes, occasions) and real-time status updates (open/closed). It is managed by Marin, an AI assistant who scouts and tags locations based on their visual and emotional appeal.

## 2. Problem Statement (The Pain Points)
- **The "Screenshot Graveyard":** Valuable discoveries on Google Maps are often saved via screenshots, becoming "dead data" that is unsearchable and hard to retrieve.
- **The "Vibe" Gap:** Google Maps allows filtering by category (Cafe, Bar) but not by vibe (e.g., "Vintage," "Speakeasy," "Quiet for coding," "Date night").
- **Data Staleness:** Saved places often close down, change addresses, or change hours without the user knowing until they arrive at the location.
- **Discovery Fatigue:** Google Maps' "Explore" feature is increasingly generic and cluttered with ads, making it hard to find hidden gems near the user.
- **Sharing Friction:** Compiling a recommendation list for friends based on specific criteria (e.g., "Quiet bars in District 1") requires manual cross-referencing and copy-pasting.
- **Decision Paralysis:** When deciding where to go, the user thinks in "Moods" ("I want somewhere quiet and dark") but search engines only understand "Keywords" ("Quiet cafe").
- **Visual Disconnect:** The user chooses places based on their "Look" (decor/lighting), which is currently a manual, tedious process of cross-referencing Instagram and Maps.

## 3. Solution Overview
A centralized system where a Telegram Bot acts as the primary ingestion and query interface.

- **Input:** User sends a screenshot or link to the Bot.
- **Processing:** Gemini AI (Vision) extracts details, analyzes photos/reviews to tag "vibes" and "occasions."
- **Storage:** Data is stored in a structured DB (MongoDB) with geospatial capabilities.
- **Maintenance:** A background Cronjob checks Google Places API to verify if saved spots are still operational.
- **Output:** User queries the bot via natural language or views a Web Dashboard.

## 4. Key Features (MVP)

### A. Smart Capture (Ingestion)
- **Screenshot Analysis:** Extracts Place Name, Address, Rating, and visual cues (decor style) from an image.
- **Link Parsing:** Extracts Place ID from shared Google Maps URLs.
- **User Annotation:** Allows users to attach a quick note/caption (e.g., "Good for client meetings") which AI adds to the context.
- **EXIF Discovery (Hidden Gems):** If a user uploads an original photo, the system extracts GPS metadata to create a location entry, enabling the saving of unlisted spots (e.g., a street food cart or scenic view) not found on Google Maps.

### B. AI Enrichment (The "Brain")
- **Vibe Tagging:** auto-tags places (e.g., #speakeasy, #industrial_decor, #specialty_coffee).
- **Suggest Tagging:** Suggests additional tags based on the image (e.g., #cyberpunk, #industrial) for user to manually approve.
- **Lighting Analysis:** Categorizes lighting as Natural, Dim, Warm, or Dark (crucial for mood).
- **Occasion Matching:** Categorizes suitability (e.g., Solo, Group, Date, Work).
- **Price Estimation:** AI analyzes menu photos or price symbols to estimate cost ($, $$, $$$).
- **Aesthetic Score:** Rates the "Instagram-ability" from 1-10.
- **Marin Comment:** Adds a quick note/caption (e.g., "Good for client meetings") which AI adds to the context.

### C. The "LocBook"
- **Status Watchdog:** Automatically flags places as CLOSED_PERMANENTLY or TEMPORARILY_CLOSED.
- **Alert System:** Telegram notification if a favorite place has permanently closed or moved.
- **Collection Sorting:** Marin sorts places into Collections: "Late Night Coding", "Date Night", "Solo Quest".
- **The "Look" Check:** Marin gives a brief "Visual Review" based on the photo.
Example: "This place has crazy good natural light! Perfect for reading, but might be too bright for a date."

### D. The "Casting" (Search & Discovery)
- **Natural Language Query:** "Find a quiet cafe near District 3 for reading tonight."
- **Mood Matching:** "Marin, I'm feeling low-key today. Where can I hide?" -> Returns quiet, dark, cozy corners.
- **Geo-Aesthetic Search:** "Find me a #Vintage cafe within 2km."
- **Random "Spot" of the Day:** Marin suggests a saved place you haven't visited yet to "complete the collection."

### E. The "Dashboard"
- **Collections:** Marin sorts places into Collections: "Late Night Coding", "Date Night", "Solo Quest".
- **The "Look" Check:** Marin gives a brief "Visual Review" based on the photo.
Example: "This place has crazy good natural light! Perfect for reading, but might be too bright for a date."

## 5. Technical Architecture

### Tech Stack
- **Interface:** Telegram Bot API (using python-telegram-bot).
- **Backend:** Python (FastAPI or Asyncio script).
- **Database:** MongoDB
- **AI Models:**
    - **Primary:** Google Gemini 2.5 Flash (via API) - For Vision OCR, summary, and vibe extraction.
    - **Fallback/Privacy:** Local LLM (Ollama/Llama 3) - For local text processing if internet/API is down.
- **External Data:** Google Places API (New) - For fetching business_status and opening_hours.

```mermaid
graph TD
    User[User (Huy)] -->|Sends Screenshot| Bot[Marin Bot]
    Bot -->|Image| Vision[Gemini 2.5 Flash]
    Vision -->|JSON: Tags, Vibe, Name| Bot
    Bot -->|Save "LocCard"| DB[(MongoDB)]
    
    User -->|Query: "Sad Mood"| Bot
    Bot -->|Query: {tags: 'Melancholic'}| DB
    DB -->|Result| Bot
    Bot -->|Reply in Persona| User
```

## 6. Functional Requirements

### 6.1. System Persona (Marin)
The bot must embody Marin:

Tone: Energetic, Gen Z, uses slang ("Slay", "Preem", "Total vibe"), very supportive.

Perspective: She treats every location hunt like preparing for a shoot.

Reaction: She reacts to the visuals of the image first.

Bad: "Place saved."

Good: "Omg! Look at those neon lights! This is total Cyberpunk vibes! Saved to the LocBook immediately!"

### 6.2. The AI Analyst Prompt (Draft)
Role: You are Marin. You are a Location Scout helping Huy build his "LocBook."
Task: Analyze this image. Extract the Place Name and Address.

Vibe Check: Look at the lighting, furniture, and colors.

Is it Modern or Retro?

Is the mood Energetic or Chill?

Visual Score: Rate the "Instagram-ability" from 1-10. Output: Return a JSON object with name, address, tags, mood, aesthetic_score, and a marin_comment.

```text
"Analyze this screenshot of a venue. Extract the following JSON:

name: Exact name of the venue.

address: Rough address or district.

category: (Cafe, Bar, Restaurant, Street Food).

vibes: Array of keywords (e.g., 'Cozy', 'Cyberpunk', 'Luxury', 'Local').

price_level: Estimate 1-4 based on context.

confidence: 0-100."
```

### 6.2. Database Schema (Draft)
**Table: places**
```json
{
  "name": "Bar 2000",
  "location": { "type": "Point", "coordinates": [106.7, 10.8] },
  "visual_tags": ["#Noir", "#Jazz", "#Speakeasy", "#RedLight"],
  "mood": "Melancholic",
  "suitability": ["Solo", "Deep Talk"],
  "marin_notes": "Totally looks like a movie set!",
  "price_tier": "$$$",
  "visited": false,
  "source_img_id": "telegram_file_id_123"
}
```

## 7. Roadmap & Expansion Ideas
**"OOTD Match" (Outfit of the Day)**
Marin suggests a location that matches the user's outfit (e.g., Suit -> Luxury Bar; Hoodie -> Street Food).

**"Duo Mode"**
If the user is   going with a friend, Marin finds the intersection of both people's preferred vibes.

**The Web Dashboard**
- **Stack:** Next.js + Leaflet/Mapbox.
- **Feature:** A "Pinterest-style" grid view of saved places, filtered by Vibe tags.

**Social & Sharing**
- **Feature:** "Export List." User asks bot "List 5 bars for Huy," bot generates a public link containing those 5 locations.

**Hardware Integration (Local AI)**
- **Feature:** If the user is at home, the system can offload extraction tasks to the local PC (using Llama 3/LLaVA) via a local API endpoint to save Gemini API costs (though Flash is very cheap).

**Menu Decoder**
- **Feature:** When at a restaurant, user sends a photo of the menu. AI suggests the "Best Value" dish or translates food names into ingredients/macros (linking to health goals).

**Soundtrack of the Place" (Spotify Integration)**
- **Feature:** Each location has a theme song or playlist that matches the vibe.

**"Crowd Meter" (Dự đoán độ đông)**
- **Feature:** AI predicts the number of people at the location based on the time of day and day of week.