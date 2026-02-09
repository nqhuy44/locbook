# Feature: Image Analysis

## 1. Overview
LocBook manages images locally to ensure fast access and simple backup. Images are associated with Places and can be uploaded via the Admin API.

## 2. Architecture
- **Manager**: `apps/api/src/core/image_manager.py`
- **Storage**: Local filesystem at `data/images/`.
- **Serving**: FastAPI StaticFiles mount at `/images`.

## 3. Logic Flow
### Upload
1. Admin sends `POST /api/upload/images` with a file.
2. API validates the file type (e.g., JPEG, PNG).
3. API generates a unique UUID filename (e.g., `550e8400-e29b-41d4-a716-446655440000.jpg`).
4. File is saved to `data/images`.
5. API returns the relative URL `/images/550e8400...jpg`.

### Retrieving
1. Frontend requests `http://api-url/images/filename.jpg`.
2. FastAPI serves the static file directly.

## 4. Backfilling (Legacy)
Scripts exist to download images from external URLs (e.g., original Google Maps links) and save them locally to ensure persistence.
