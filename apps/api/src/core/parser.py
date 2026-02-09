import re
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional, List
import json
import logging
from src.core.llm import ai_service
from src.config import get_settings

logger = logging.getLogger(__name__)

class LinkParser:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    def extract_url(self, text: str) -> Optional[str]:
        """Extract first URL from text."""
        url_regex = r"(https?://\S+)"
        matches = re.findall(url_regex, text)
        return matches[0] if matches else None

    def is_google_maps_url(self, url: str) -> bool:
        return "google.com/maps" in url or "goo.gl/maps" in url or "maps.app.goo.gl" in url

    async def _call_places_api(self, text_query: str) -> Optional[Dict[str, Any]]:
        """Call Google Places API (New) Text Search."""
        settings = get_settings()
        api_key = settings.GOOGLE_PLACES_API_KEY or settings.GEMINI_API_KEY
        
        if not api_key:
            return None
            
        try:
            url = "https://places.googleapis.com/v1/places:searchText"
            
            # Dynamic FieldMask based on Config
            base_fields = ["places.name", "places.displayName", "places.formattedAddress", "places.types", 
                           "places.rating", "places.userRatingCount", "places.priceLevel", "places.currentOpeningHours",
                           "places.location"]
            
            # Logic: Reviews depends on MAX_REVIEWS_FOR_AI
            if settings.MAX_REVIEWS_FOR_AI > 0:
                base_fields.append("places.reviews")

            # Logic: Photos depends on FEAT_IMAGE_ANALYSIS
            if settings.FEAT_IMAGE_ANALYSIS:
                base_fields.append("places.photos")
            
            headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": ",".join(base_fields)
            }
            payload = {"textQuery": text_query}
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if "places" in data and data["places"]:
                        return data["places"][0] # Return best match
        except Exception as e:
            logger.warning(f"Places API access failed: {e}")
        return None

    async def geocode_place(self, name: str, address: str = None) -> Optional[Dict[str, Any]]:
        """
        Geocode a place by name and optional address to get coordinates.
        Returns dictionary with 'location' (lat/long) and 'address' (formatted).
        """
        query = f"{name} {address}" if address else name
        place_data = await self._call_places_api(query)
        
        if place_data and "location" in place_data:
            return {
                "location": place_data["location"],
                "address": place_data.get("formattedAddress")
            }
        return None


    async def _fetch_photo_bytes(self, photo_name: str) -> Optional[tuple[bytes, str]]:
        """Fetch photo bytes and mime_type from Google Places Media API."""
        settings = get_settings()
        api_key = settings.GOOGLE_PLACES_API_KEY or settings.GEMINI_API_KEY
        if not api_key: return None
        
        try:
            # url format: https://places.googleapis.com/v1/{name}/media
            url = f"https://places.googleapis.com/v1/{photo_name}/media"
            params = {
                "key": api_key,
                "maxHeightPx": 800,
                "maxWidthPx": 800,
                "skipHttpRedirect": True 
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Step 1: Get Photo URI
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    photo_uri = data.get("photoUri")
                    
                    if photo_uri:
                        # Step 2: Download Image
                        img_resp = await client.get(photo_uri)
                        if img_resp.status_code == 200:
                            mime_type = img_resp.headers.get("Content-Type", "image/jpeg")
                            return img_resp.content, mime_type
                            
        except Exception as e:
            logger.warning(f"Failed to fetch photo {photo_name}: {e}")
        return None

    async def fetch_place_info(self, url: str) -> Dict[str, Any]:
        """
        Fetch raw place info and images. Returns a dict ready for LLM processing.
        Structure: {"raw_api": ..., "scraped": ..., "images": [bytes...], "context_text": "..."}
        """
        try:
            place_name_from_url = "Unknown Place"
            page_title = "Unknown"
            og_title_content = ""
            scraped_images = []
            
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=10.0) as client:
                # Expand URL
                if "goo.gl" in url or "maps.app.goo.gl" in url or "g.co" in url:
                    resp = await client.get(url)
                    url = str(resp.url)
                
                logger.info(f"Analyzing URL: {url}")
                
                # Extract Name from URL
                try:
                    import urllib.parse
                    parts = url.split("/place/")[1].split("/")[0]
                    place_name_from_url = urllib.parse.unquote(parts).replace("+", " ")
                except Exception:
                    pass
                
                # Scrape Fallback
                try:
                    resp = await client.get(url)
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    if soup.title:
                        page_title = soup.title.string.replace(" - Google Maps", "").strip()
                    og_title = soup.find("meta", property="og:title")
                    if og_title:
                        og_title_content = og_title['content']
                    
                    # Scrape og:image (Free Thumbnail)
                    og_image = soup.find("meta", property="og:image")
                    if og_image and og_image.get('content'):
                        img_url = og_image['content']
                        # Filter out generic Google Maps icons/logos and Static Maps
                        if "google_maps_logo" not in img_url and "icon" not in img_url and "staticmap" not in img_url:
                             logger.info(f"Found og:image: {img_url}")
                             try:
                                 img_resp = await client.get(img_url, timeout=5.0)
                                 if img_resp.status_code == 200:
                                     # Store tuple (bytes, mime_type)
                                     # Need to make sure photos_bytes is available or define it here
                                     # Since I can't easily move the variable definition in this Replace block without context,
                                     # I will return this in a specialized way or use a temp list.
                                     # Let's see... I'll define a temp list here.
                                     scraped_images.append((img_resp.content, img_resp.headers.get("Content-Type", "image/jpeg")))
                             except Exception as e:
                                 logger.warning(f"Failed to download og:image: {e}")

                except Exception as e:
                    logger.warning(f"Scraping failed: {e}")

            # --- Try Places API ---
            places_api_data = None
            photos_bytes = list(scraped_images) # Start with scraped images
            
            search_query = place_name_from_url if place_name_from_url != "Unknown Place" else (og_title_content or page_title)
            
            if search_query and search_query != "Unknown":
                places_api_data = await self._call_places_api(search_query)
            
            # --- Fetch Images ---
            settings = get_settings()
            if settings.FEAT_IMAGE_ANALYSIS and places_api_data and "photos" in places_api_data:
                # Get top 3 photos
                top_photos = places_api_data["photos"][:3]
                for p in top_photos:
                    if "name" in p: # Resource name 'places/PLACE_ID/photos/PHOTO_ID'
                        img_data = await self._fetch_photo_bytes(p["name"])
                        if img_data:
                            # img_data is now (bytes, mime_type)
                            photos_bytes.append(img_data)

            # --- Prepare Context Text for LLM ---
            final_place_name = place_name_from_url
            content_text = ""
            
            if places_api_data:
                 # Clean text for display name
                display_name = places_api_data.get("displayName", {}).get("text", final_place_name)
                final_place_name = display_name
                
                reviews_text = ""
                if "reviews" in places_api_data:
                    settings = get_settings()
                    max_revs = settings.MAX_REVIEWS_FOR_AI
                    for r in places_api_data["reviews"][:max_revs]:
                        text = r.get("text", {}).get("text", "")
                        if text:
                            # Truncate very long reviews to save tokens
                            if len(text) > 300:
                                text = text[:300] + "..."
                            reviews_text += f"- {text}\n"
                
                content_text = f"""
                Source: Google Places API
                Name: {final_place_name}
                Address: {places_api_data.get('formattedAddress', 'Unknown')}
                Types: {', '.join(places_api_data.get('types', []))}
                Rating: {places_api_data.get('rating', 'N/A')} ({places_api_data.get('userRatingCount', 0)} reviews)
                Price Level: {places_api_data.get('priceLevel', 'Unknown')}
                Opening Hours: {places_api_data.get('currentOpeningHours', {}).get('weekdayDescriptions', [])}
                
                Top Reviews (Use these for Vibes/Mood):
                {reviews_text}
                """
            else:
                 content_text = f"""
                Source: URL Scraping (Low Confidence)
                URL: {url}
                Extracted Name: {final_place_name}
                Page Title: {page_title}
                OG Title: {og_title_content}
                """
            
            return {
                "status": "success",
                "text_data": content_text,
                "images": photos_bytes,
                "raw_api": places_api_data, # Return raw for any explicit usage if needed
                "url": url,
                "inferred_name": final_place_name
            }
            
        except Exception as e:
            logger.error(f"Link parsing failed: {e}")
            return {"error": str(e)}

link_parser = LinkParser()
