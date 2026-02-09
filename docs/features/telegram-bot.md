# Feature: Telegram Bot

## 1. Overview
The Telegram Bot provides an alternative interface for users to interact with LocBook directly from their chat app. It mirrors the core search functionality.

## 2. Architecture
- **Handler**: `apps/api/src/bot/handlers.py`
- **Framework**: `python-telegram-bot`
- **Mode**: Webhook (production) or Polling (dev).

## 3. Commands
- `/start`: Welcome message and introduction.
- `/help`: Usage instructions.
- `/search <query>`: Direct search trigger.
- **Text Messages**: Treated as chat/search queries.

## 4. Logic Flow
1. **Webhook Receive**: API receives update from Telegram.
2. **Dispatcher**: Routes update to `handlers.py`.
3. **Processing**:
    - **Commands**: Executed immediately.
    - **Text**: Forwarded to `ChatService` (same as Web API).
4. **Response**: 
    - Text response from LLM sent back to user.
    - Place images sent as a media group if available.

## 5. Security
- Webhook endpoint is secret/protected.
- Admin commands (if any) require checking User ID against a whitelist.
