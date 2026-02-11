# Feature: Image Processing & Storage

> **PRD Reference**: Section 4.2 (Current System)
> **Status**: ✅ Working
> **Source**: `src/core/image_manager.py`, `src/api.py` (static mount)

---

## Overview

LocBook stores place images **locally** on the server filesystem. Images are downloaded from Google Places API or uploaded via the admin dashboard, then served as static files via FastAPI. Each place can have multiple image URLs and a primary `local_image_path`.

---

## Architecture

```
Image Source
    ├── Google Places API (downloaded by parser.py)
    ├── Telegram Bot (received photo)
    └── Admin Upload (POST /api/upload-avatar)
    ↓
image_manager.save_image(data, filename)
    ↓
data/images/{uuid}.{ext}
    ↓
Served at /images/{uuid}.{ext} (FastAPI StaticFiles)
```

---

## Image Manager (`src/core/image_manager.py`)

### Key Methods

| Method | Description |
| :--- | :--- |
| `save_image(data: bytes, filename: str)` | Save raw bytes to disk |
| `get_image_url(filename: str)` | Return relative URL path |

### Storage Path

```
data/images/
├── abc123.jpg      ← Place hero image
├── def456.png      ← Menu screenshot
└── avatar_xyz.jpg  ← Marin avatar
```

Created on startup:
```python
os.makedirs("data/images", exist_ok=True)
```

### Static File Serving

```python
app.mount("/images", StaticFiles(directory="data/images"), name="images")
```

All images accessible at: `{API_URL}/images/{filename}`

---

## Place Image Fields

| Column | Type | Description |
| :--- | :--- | :--- |
| `images` | Array[String] | List of image URLs (Google Photos or local) |
| `local_image_path` | String | Primary local image path |

### Image Sources per Place

1. **Google Places API**: Downloaded during link parsing (`_fetch_photo_bytes`). Stored locally, URL saved to `images[]`.
2. **Telegram Photo**: Received via bot `handle_photo`. Processed by Gemini Vision, then stored.
3. **Admin Upload**: Via `POST /api/upload-avatar` (currently admin-only).

---

## Docker Volume Mapping

In production, `data/images/` is mounted as a Docker volume to persist across container restarts:

```yaml
volumes:
  - ./data:/app/data  # Persist images
```

---

## Future Enhancements (PRD 2.0)

### Image Optimization
- [ ] Resize/compress on upload (e.g., max 1200px width, WebP format).
- [ ] Generate thumbnails for list views (300px).
- [ ] Lazy loading on frontend.

### Cloud Storage Migration
- [ ] Move from local filesystem to S3/GCS for scalability.
- [ ] CDN integration for faster delivery.
- [ ] Presigned upload URLs for client-side uploads.

### Memo Images
- [ ] Allow image uploads for Memos (Phase 5.1).
- [ ] Associate images with `Memo.images[]` array.

### AI Image Analysis
- [ ] Auto-compute `aesthetic_score` from place photos via Gemini Vision.
- [ ] Detect image categories (food, interior, exterior) for smart gallery.
