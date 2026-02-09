# API Documentation - LocBook

## 1. Overview
The LocBook API is built with Python/FastAPI. It handles all backend logic for:
- Chat & AI Search
- Place Management (CRUD)
- Telegram Bot Webhooks/Tasks
- Vector Search Integration

Base URL: `http://localhost:8000` (Local Dev)

## 2. Authentication
- **Admin Endpoints**: Require `x-admin-token` header.
- **Public Endpoints**: No authentication required.

## 3. Endpoints

### 3.1 Chat & Search
**POST** `/api/chat`
- **Description**: Interact with the AI assistant.
- **Request Body**:
  ```json
  {
    "message": "cozy cafe district 1",
    "session_id": "optional-uuid"
  }
  ```
- **Response**:
  ```json
  {
    "response": "Here are some cafes...",
    "session_id": "uuid",
    "sources": [...]
  }
  ```

### 3.2 Place Management (Admin)
**GET** `/api/places`
- **Query Params**: `limit`, `offset`, `search`
- **Description**: List places with pagination.

**GET** `/api/places/{place_id}`
- **Description**: Get detailed information for a specific place.

**PUT** `/api/places/{place_id}`
- **Header**: `x-admin-token`
- **Body**: updated place fields.
- **Description**: Update place details.

**DELETE** `/api/places/{place_id}`
- **Header**: `x-admin-token`
- **Description**: Delete a place.

**POST** `/api/upload/avatar`
- **Header**: `x-admin-token`
- **Body**: `multipart/form-data` (file)
- **Description**: Upload an image for a place. Returns image URL.

### 3.3 Maintenance
**POST** `/api/reindex`
- **Header**: `x-admin-token`
- **Description**: Trigger background re-indexing of vector embeddings.

**GET** `/api/stats`
- **Description**: Get database statistics (count of places, categories, etc.).

## 4. Models
### Place
- `id`: str
- `name`: str
- `address`: str
- `category`: str
- `description`: str
- `vibe`: List[str]
- `images`: List[str]
