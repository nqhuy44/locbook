# Product Requirements Document (PRD) - Spotary

## 1. Introduction
Spotary is a local guide application for Ho Chi Minh City, utilizing AI to match users with places (cafes, bars, restaurants) that fit their vibe and needs. It offers a web dashboard for users, an admin dashboard for management, and a Telegram bot for convenient access.

## 2. Goals
- **Personalized Recommendations**: Use AI to understand natural language queries (e.g., "cozy cafe for working", "lively pub for group").
- **Rich Data**: Manage a curated database of local spots with detailed metadata (images, reviews, menus).
- **Multi-Platform Access**: Accessible via Web and Telegram.
- **Admin Efficiency**: Easy-to-use tools for adding and updating places.

## 3. Architecture Overview
The system follows a Monorepo structure managed by Nx.

### Components
- **Apps**:
  - `apps/api`: Python FastAPI backend. Handles business logic, AI integration, and database access.
  - `apps/dashboard`: React/Vite user frontend. Optimized for mobile and desktop.
  - `apps/admin`: React/Vite admin frontend. For data entry and management.
- **Data**:
  - **MongoDB**: Primary database for places and user sessions.
  - **ChromaDB**: Vector database for semantic search.
  - **Google Gemini**: LLM for intent extraction and response generation.

## 4. Key Features

### 4.1 AI Search & Chat (RAG)
- **Natural Language Parsing**: Users can chat naturally.
- **Context Retention**: Remembers conversation history for refined queries.
- **Semantic Search**: Finds places based on "vibe" and "mood", not just keywords.
- **Rich Responses**: Returns structured data (cards) alongside text.

### 4.2 Place Management
- **CRUD Operations**: Admins can create, read, update, and delete places.
- **Image Management**: Upload and serve images locally.
- **Categorization**: flexible tagging system (e.g., "Cafe", "Work", "Date").

### 4.3 Telegram Integration
- **Bot Interface**: Full chat functionality via Telegram.
- **Menu Commands**: /start, /help, /search.

### 4.4 Data Maintenance
- **Vector Re-indexing**: Scripts to regenerate embeddings when data changes.
- **Automated Backups**: Scripts for database backup and restore.

## 5. User Flows
- **User**: Opens Dashboard -> Types "cafe quiet" -> AI analyzes -> returns standard cafes + description.
- **Admin**: Log in -> Add Place -> Upload Images -> Save -> Trigger Re-index to make it searchable.

## 6. Future Roadmap
- User Accounts & Favorites.
- Community Reviews.
- Multi-city support.
- Advanced Analytics.