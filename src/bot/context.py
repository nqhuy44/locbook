from typing import Dict, Any, Optional
import datetime

class UserContext:
    def __init__(self):
        # structure: { user_id: { "pending_search": { ...data... }, "timestamp": datetime } }
        self._store: Dict[int, Dict[str, Any]] = {}

    def set_pending_search(self, user_id: int, search_data: Dict[str, Any]):
        self._store[user_id] = {
            "pending_search": search_data,
            "timestamp": datetime.datetime.now()
        }

    def get_pending_search(self, user_id: int) -> Optional[Dict[str, Any]]:
        data = self._store.get(user_id)
        if not data:
            return None
        
        # Expire after 5 minutes
        if (datetime.datetime.now() - data["timestamp"]).total_seconds() > 300:
            del self._store[user_id]
            return None
            
        return data["pending_search"]

    def clear(self, user_id: int):
        if user_id in self._store:
            del self._store[user_id]

# Singleton instance
user_context_store = UserContext()
