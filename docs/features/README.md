# Spotary Feature Documentation

> Detailed documentation for every feature in the Spotary platform.
> Each file below covers: architecture, data models, API endpoints, current status, and planned enhancements from [PRD 2.0](../prd-2.0.md).

---

## Current Features (Working)

| # | Feature | File | Status |
| :--- | :--- | :--- | :--- |
| 01 | **Telegram Bot** — Screenshot analysis, link parsing, geo-search | [01-telegram-bot.md](./01-telegram-bot.md) | ✅ |
| 02 | **Authentication** — Google OAuth 2.0, JWT sessions | [02-authentication.md](./02-authentication.md) | ✅ |
| 03 | **Place Management** — CRUD, data model, image storage | [03-place-management.md](./03-place-management.md) | ✅ |
| 04 | **Semantic Search** — pgvector, personalized discovery | [04-semantic-search.md](./04-semantic-search.md) | ✅ |
| 05 | **AI Chat (Marin)** — RAG conversational agent | [05-ai-chat-marin.md](./05-ai-chat-marin.md) | ✅ |
| 06 | **Interactions & Upvoting** — Votes, views, bookmarks | [06-interactions-upvoting.md](./06-interactions-upvoting.md) | ✅ |
| 07 | **User Profile & Onboarding** — Vibe quiz, preferences | [07-user-profile-onboarding.md](./07-user-profile-onboarding.md) | ✅ |
| 11 | **Map View** — Leaflet interactive map | [11-map-view.md](./11-map-view.md) | ✅ |
| 12 | **Admin & Configuration** — Dynamic config, stats | [12-admin-configuration.md](./12-admin-configuration.md) | ✅ |
| 13 | **Google Maps Integration** — Places API, URL parsing | [13-google-maps-integration.md](./13-google-maps-integration.md) | ✅ |
| 14 | **Image Processing** — Local storage, static serving | [14-image-processing.md](./14-image-processing.md) | ✅ |
| 15 | **Dashboard UI** — React frontend, cards, filters, chat | [15-dashboard-ui.md](./15-dashboard-ui.md) | ✅ |

## Planned Features (PRD 2.0)

| # | Feature | File | Phase |
| :--- | :--- | :--- | :--- |
| 08 | **Memo System** — Personal place journal | [08-memo-system.md](./08-memo-system.md) | Phase 5 |
| 09 | **Collections** — Curated place lists | [09-collections.md](./09-collections.md) | Phase 5 |
| 10 | **Social Graph** — Follow system, activity feed | [10-social-graph.md](./10-social-graph.md) | Phase 5 |

---

## Quick Reference: Source Locations

| Area | Path |
| :--- | :--- |
| Backend API | `apps/api/src/api.py` |
| Bot Handlers | `apps/api/src/bot/handlers.py` |
| Core Services | `apps/api/src/core/` |
| Routers | `apps/api/src/routers/` |
| Database Models | `apps/api/src/database/sql_models.py` |
| User Dashboard | `apps/dashboard/src/` |
| Admin Dashboard | `apps/admin/src/` |
| Config | `apps/api/src/config.py` |
