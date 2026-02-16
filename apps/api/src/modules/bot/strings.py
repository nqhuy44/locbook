
# Messages for Marin Bot

# Welcome / Help
WELCOME_MESSAGE = (
    "Moshi Moshi! {user_mention}! Mình là Marin, AI Location Scout. 📸\n"
    "Gửi link Google Maps để mình phân tích và lưu vào Spotary nha!"
)
HELP_MESSAGE = "📌 Gửi link Google Maps cho Marin để check quán nha!"
DEFAULT_RESPONSE = "😳 Gửi link Google Maps cho Marin đi! Marin chưa hiểu ý bạn nè."

# Status
SEARCHING_MSG = "🔎 Marin thấy link rồi! Đang đi soi quán này nha...\n ({url})"
MARIN_BUSY = "😋 Marin đang bận ăn bánh mì... 🥖"
MSG_ALREADY_SAVED = "<i>(Mình đã lưu quán này rồi nha! ID: {id})</i>"
MSG_VIEW_FROM_LOCBOOK = "<i>(Xem lại từ Spotary)</i>"
MSG_PLACE_NOT_FOUND = "😩 Marin tìm hoài vẫn không thấy quán này"

# Errors
ERROR_FETCH_FAIL = "🤔 Hic! Marin không xem được quán này:\n {error}"
ERROR_AI_FAIL = "🧠 {error}"
ERROR_GENERIC = "💥 {error}"
ERR_MSG_429 = "Marin chóng mặt quá, bạn chờ 1 lát rồi thử lại nha! 😵💫"
ERR_MSG_5XX = "Google đang đi ngủ rồi, Marin nghỉ tay xíu đây. 😴"
ERR_MSG_404 = "Marin tìm hoài không thấy quán này, bạn kiểm tra lại link giúp mình nha!"
ERR_MSG_400 = "Hình như link bị lỗi rồi, Marin không đọc được. 🥺"
ERR_MSG_UNKNOWN = "Marin bị vấp cục đá, thử lại sau nhé! 🤕"

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
    "✅ <i>Đã lưu vào Spotary!</i>"
)