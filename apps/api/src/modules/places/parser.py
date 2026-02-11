import re
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional
import logging
from src.core.config import get_settings
from src.core.utils import to_toon

logger = logging.getLogger(__name__)


class LinkParser:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

    def extract_url(self, text: str) -> Optional[str]:
        """Extract first URL from text."""
        matches = re.findall(r"(https?://\S+)", text)
        return matches[0] if matches else None

    def is_google_maps_url(self, url: str) -> bool:
        return any(host in url for host in ("google.com/maps", "goo.gl/maps", "maps.app.goo.gl"))

    async def _call_places_api(self, text_query: str) -> Optional[Dict[str, Any]]:
        """Call Google Places API (New) Text Search."""
        settings = get_settings()
        api_key = settings.GOOGLE_PLACES_API_KEY or settings.GEMINI_API_KEY
        if not api_key:
            return None

        try:
            url = "https://places.googleapis.com/v1/places:searchText"

            base_fields = [
                "places.name", "places.displayName", "places.formattedAddress",
                "places.types", "places.rating", "places.userRatingCount",
                "places.priceLevel", "places.currentOpeningHours", "places.location",
            ]

            if settings.MAX_REVIEWS_FOR_AI > 0:
                base_fields.append("places.reviews")

            if settings.FEAT_IMAGE_ANALYSIS:
                base_fields.append("places.photos")

            headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": ",".join(base_fields),
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json={"textQuery": text_query}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if "places" in data and data["places"]:
                        return data["places"][0]
        except Exception as e:
            logger.warning(f"Places API failed: {e}")
        return None

    async def geocode_place(self, name: str, address: str = None) -> Optional[Dict[str, Any]]:
        """Geocode a place by name to get coordinates."""
        query = f"{name} {address}" if address else name
        place_data = await self._call_places_api(query)

        if place_data and "location" in place_data:
            return {
                "location": place_data["location"],
                "address": place_data.get("formattedAddress"),
            }
        return None

    async def _fetch_photo_bytes(self, photo_name: str) -> Optional[tuple[bytes, str]]:
        """Fetch photo bytes from Google Places Media API."""
        settings = get_settings()
        api_key = settings.GOOGLE_PLACES_API_KEY or settings.GEMINI_API_KEY
        if not api_key:
            return None

        try:
            url = f"https://places.googleapis.com/v1/{photo_name}/media"
            params = {"key": api_key, "maxHeightPx": 800, "maxWidthPx": 800, "skipHttpRedirect": True}

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    photo_uri = resp.json().get("photoUri")
                    if photo_uri:
                        img_resp = await client.get(photo_uri)
                        if img_resp.status_code == 200:
                            return img_resp.content, img_resp.headers.get("Content-Type", "image/jpeg")
        except Exception as e:
            logger.warning(f"Failed to fetch photo {photo_name}: {e}")
        return None

    async def fetch_place_info(self, url: str) -> Dict[str, Any]:
        """Fetch place info from Google Maps URL. Returns data ready for LLM."""
        try:
            place_name_from_url = "Unknown Place"
            page_title = "Unknown"
            og_title_content = ""
            scraped_images = []

            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=10.0) as client:
                # Expand short URLs
                if any(host in url for host in ("goo.gl", "maps.app.goo.gl", "g.co")):
                    resp = await client.get(url)
                    url = str(resp.url)

                logger.info(f"Analyzing URL: {url}")

                # Extract name from URL path
                try:
                    import urllib.parse
                    parts = url.split("/place/")[1].split("/")[0]
                    place_name_from_url = urllib.parse.unquote(parts).replace("+", " ")
                except Exception:
                    pass

                # Scrape page
                try:
                    resp = await client.get(url)
                    soup = BeautifulSoup(resp.text, "html.parser")
                    if soup.title:
                        page_title = soup.title.string.replace(" - Google Maps", "").strip()
                    og_title = soup.find("meta", property="og:title")
                    if og_title:
                        og_title_content = og_title["content"]

                    # Scrape og:image thumbnail
                    og_image = soup.find("meta", property="og:image")
                    if og_image and og_image.get("content"):
                        img_url = og_image["content"]
                        skip_patterns = ("google_maps_logo", "icon", "staticmap")
                        if not any(p in img_url for p in skip_patterns):
                            try:
                                img_resp = await client.get(img_url, timeout=5.0)
                                if img_resp.status_code == 200:
                                    scraped_images.append(
                                        (img_resp.content, img_resp.headers.get("Content-Type", "image/jpeg"))
                                    )
                            except Exception as e:
                                logger.warning(f"Failed to download og:image: {e}")
                except Exception as e:
                    logger.warning(f"Scraping failed: {e}")

            # Places API
            photos_bytes = list(scraped_images)
            search_query = place_name_from_url if place_name_from_url != "Unknown Place" else (og_title_content or page_title)
            places_api_data = None

            if search_query and search_query != "Unknown":
                places_api_data = await self._call_places_api(search_query)

            # Fetch photos from API
            settings = get_settings()
            if settings.FEAT_IMAGE_ANALYSIS and places_api_data and "photos" in places_api_data:
                for p in places_api_data["photos"][:3]:
                    if "name" in p:
                        img_data = await self._fetch_photo_bytes(p["name"])
                        if img_data:
                            photos_bytes.append(img_data)

            # Build context text in TOON format for token efficiency
            final_place_name = place_name_from_url

            if places_api_data:
                display_name = places_api_data.get("displayName", {}).get("text", final_place_name)
                final_place_name = display_name

                # Build structured context
                context_data = {
                    "source": "Google Places API",
                    "name": final_place_name,
                    "address": places_api_data.get("formattedAddress", "Unknown"),
                    "types": places_api_data.get("types", []),
                    "rating": f"{places_api_data.get('rating', 'N/A')} ({places_api_data.get('userRatingCount', 0)} reviews)",
                    "price_level": places_api_data.get("priceLevel", "Unknown"),
                }

                # Opening hours
                hours = places_api_data.get("currentOpeningHours", {}).get("weekdayDescriptions", [])
                if hours:
                    context_data["opening_hours"] = hours

                # Reviews (truncated for token savings)
                if "reviews" in places_api_data:
                    max_revs = settings.MAX_REVIEWS_FOR_AI
                    reviews = []
                    for r in places_api_data["reviews"][:max_revs]:
                        text = r.get("text", {}).get("text", "")
                        if text:
                            reviews.append(text[:300] + "..." if len(text) > 300 else text)
                    if reviews:
                        context_data["reviews"] = reviews

                content_text = to_toon(context_data)
            else:
                content_text = to_toon({
                    "source": "URL Scraping (Low Confidence)",
                    "url": url,
                    "name": final_place_name,
                    "page_title": page_title,
                    "og_title": og_title_content,
                })

            return {
                "status": "success",
                "text_data": content_text,
                "images": photos_bytes,
                "raw_api": places_api_data,
                "url": url,
                "inferred_name": final_place_name,
            }

        except Exception as e:
            logger.error(f"Link parsing failed: {e}")
            return {"error": str(e)}


link_parser = LinkParser()
