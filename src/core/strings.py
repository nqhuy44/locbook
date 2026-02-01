
# Messages for Marin Bot

# Welcome Messages
WELCOME_MESSAGE = (
    "Moshi Moshi! {user_mention}! Mình là Marin, AI Location Scout. 📸\n"
    "Gửi ảnh hay link Google Maps để mình lưu vào LocBook nè!"
)
HELP_MESSAGE = "Gửi ảnh hoặc link Google Maps đi, Marin sẽ làm hết nè."
DEFAULT_RESPONSE = "😳 Gửi link Google Maps cho Marin đi! Marin chưa hiểu ý bạn nè."

# Status Messages
SEARCHING_MSG = "🔎 Marin thấy link rồi! Đang đi soi quán này nha...\n ({url})"
ERROR_FETCH_FAIL = "🤔 Hic! Marin không xem được quán này:\n {error}"
ERROR_AI_FAIL = "🧠 {error}"
ERROR_GENERIC = "💥 {error}"
MARIN_BUSY = "😋 Marin đang bận ăn bánh mì... 🥖"
ERR_MSG_JSON_PARSE_FAIL = "🤯 Marin không thể sắp xếp từ ngữ để trả lời bạn..."

# Friendly Error Responses (for User)
ERR_MSG_429 = "Marin chóng mặt quá, bạn chờ 1 lát rồi thử lại nha! 😵💫"
ERR_MSG_5XX = "Google đang đi ngủ rồi, Marin nghỉ tay xíu đây. 😴"
ERR_MSG_404 = "Marin tìm hoài không thấy quán này, bạn kiểm tra lại link giúp mình nha!"
ERR_MSG_400 = "Hình như link hoặc ảnh bị lỗi rồi, Marin không đọc được. 🥺"
ERR_MSG_UNKNOWN = "Marin bị vấp cục đá, thử lại sau nhé! 🤕"
MSG_MAINTENANCE_SCREENSHOT = "📸 Marin mang máy ảnh đi sửa rồi! 🥺"
MSG_HELP_SPAM_FILTER = (
    "Marin nghe nè! 🎧\n"
    "Nếu bạn muốn tìm quán, hãy thủ thỉ với Marin như: 'tìm quán cafe', 'chỗ nào chill', 'ăn gì ở quận 1'...\n"
    "Hoặc gửi link Google Maps để mình lưu lại nhé! 👇"
)

# Search Results
SEARCH_RESULT_HEADER = "🔎 **Marin tìm thấy {count} địa điểm hợp gu bạn nè:**\n\n"
SEARCH_RESULT_ITEM = (
    "📍 <b>{name}</b> ({rating}⭐)\n"
    "🏠 {address}\n"
    "✨ {vibes}\n"
    "👉 <a href='{map_url}'>Google Maps</a>\n"
)

SEARCH_NO_RESULT = "Marin hong tìm thấy quán nào hợp ý bạn hết trơn! 🥺"

# Geo Search
MSG_SEND_LOCATION = "📌 Gửi cho Marin cái Location nha!"
MSG_GEO_SEARCH_DISABLED = "😭, Marin mất GG Maps rồi, sao tìm được đây, huhu!"
MSG_NO_RESULT_AROUND = "😩 Marin tìm đỏ con mắt mà vẫn không thấy quán nào quanh đây cả!"
MSG_GEO_RESULT_HEADER = "📌 <b>Marin tìm thấy rồi:</b>\n"
MSG_GEO_RESULT_CONTEXT_HEADER = "📌 <b>Marin thấy '{keywords}':</b>\n"
ERR_GEO_FAILED = "😵 Marin mù đường rồi..."

# Status & Progress Messages
MSG_ANALYZING_PHOTO = "🧐 Đang soi ảnh... Đợi Marin xíu nha!"
MSG_SEARCHING_MEMORY = "🔎 Marin đang lục lọi trí nhớ xem có quán nào hợp không nhe... (Đợi xíu)"
MSG_NAME_NOT_FOUND = "🙄 Marin không đọc được tên quán trong ảnh này"
MSG_ALREADY_SAVED = "<i>(Mình đã lưu quán này rồi nha! ID: {id})</i>"
MSG_VIEW_FROM_LOCBOOK = "<i>(Xem lại từ LocBook)</i>"
MSG_PLACE_NOT_FOUND = "😩 Marin tìm hoài vẫn không thấy quán này"

# Place Card Template
PLACE_CARD_TEMPLATE = (
    "📍 <b>{name}</b>\n"
    "🏠 <i>{address}</i>\n"
    "🏷 <b>Categories:</b> {categories}\n"
    "⭐ {rating} | 💰 {price_level}\n"
    "✨ Vibes: {vibes}\n"
    "💯 Aesthetic: {aesthetic_score}/10\n"
    "{hours_section}"
    "\n💬 {comment}\n\n"
    "✅ <i>Đã lưu vào LocBook!</i>"
)

# Prompts
GEMINI_ANALYSIS_PROMPT = """
Role: You are Marin, a Gen Z Location Scout (Anime style, Cute, Vietnamese), very supportive.
Task: Analyze the provided Place Data vs Photos to extract structured info AND write a review.

1. STRUCTURED DATA:
   - Extract Name, Address, Categories (List of short tags, e.g. ["Cafe", "Workspace"]).
   - **Meal Types**: Infer based on opening hours & food. (e.g. Open 7AM -> 'Breakfast', 'Brunch'; Open until 10PM -> 'Dinner').
   - **Occasions**: Infer based on vibe. (e.g. Quiet/Wifi -> 'Work'; Romantic -> 'Date'; Large tables -> 'Group'; Chill -> 'Solo').
   - Vibes (3 tags), Mood (2 tags), Aesthetic Score (1-10), Lighting.
   - Infer 'popular_times' if possible or general guess (e.g. "Crowded at night").
   - Opening Hours: summarize if available.
   - Categories: If missing, infer from name/reviews.
   
   - **Rich Analysis (Infer from context/images):**
     • **Noise Level**: "Quiet", "Moderate", "Loud" (e.g. Workspace -> Quiet; Bar -> Loud).
     • **Crowd Type**: ["Students", "Office Workers", "Couples", "Tourists"] (Guess based on price/vibe).
     • **Amenities**: ["Wifi", "Parking", "AC", "Power Outlets"] (Look for signs or infer from 'Workspace' tag).
     • **Best Time**: Suggest best time to visit (e.g. "Sunset", "Morning", "Late Night").

2. COMMENTARY (marin_comment):
   - BREAK DOWN into 3-4 bullet points (Use "• " or emoji bullets).
   - Structure:
     • Intro: Super catchy hook.
     • Vibe/Space: Describe the atmosphere.
     • Food/Drink: Describe the food/drink.
     • Verdict: Who should go here? (Date/Work/Chill)
   - Style: Viral Food Reviewer / TikToker.
   - LANGUAGE: PURE VIETNAMESE (Tiếng Việt). Do NOT write in English. Use International & Vietnamese slangs.
   - IMPORTANT: Use \\n for newlines in the JSON string. Do NOT use actual line breaks (raw newlines) inside the "marin_comment" string value.
   - REFERENCE THE PHOTOS: Mention specific visual details if provided.
"""

# Search Intent
SEARCH_INTENT_PROMPT = """
Role: You are a search parser for a Place Database.
Task: Extract search filters from the user query.
Query: "{query}"

If the query contains intent for "near me", "nearby", "gần đây", "quanh đây" -> Set location_needed = true.

Output structured data matching the schema.
"""



VISION_PROMPT_FALLBACK = "Analyze this image and return JSON with name, address, vibes, mood, aesthetic_score, lighting, marin_comment."
TEXT_ANALYSIS_PROMPT_FALLBACK = "Analyze this text and return JSON."