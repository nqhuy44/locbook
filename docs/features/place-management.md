# Feature: Place Management (Admin)

## 1. Overview
The Place Management system allows administrators to curate the database of locations. It provides a CRUD interface via the API and Admin Dashboard.

## 2. Architecture
- **API Endpoints**: `apps/api/src/api.py`
- **Database**: MongoDB (`places` collection)
- **Image Storage**: Local filesystem (`data/images`)

## 3. Data Model (`Place`)
- **ID**: Unique string identifier.
- **Name**: Name of the venue.
- **Address & Coordinates**: Physical location.
- **Category**: Main category (Cafe, Bar, Restaurant, etc.).
- **Vibe/Tags**: List of descriptors (Cozy, Lively, Cheap).
- **Images**: List of image URLs.
- **Metadata**: Price range, opening hours, etc.

## 4. Workflows
### Creating a Place
1. Admin enters details in the Dashboard.
2. API validates data.
3. Place is saved to MongoDB.
4. **Important**: The place is NOT immediately searchable via AI until re-indexed.

### Updating Images
1. Admin uploads an image file.
2. API saves it to `data/images/{uuid}.jpg`.
3. API returns the public URL.
4. Admin adds the URL to the Place record.

### Configuration
Admin can also update dynamic app settings (e.g., toggling features, updating prompts) via the `/api/config` endpoint.
