from datetime import datetime, timedelta, timezone
import collections

class RateLimiter:
    def __init__(self):
        # Dictionary to store user request timestamps
        # Key: user_id, Value: deque of timestamps
        self.user_requests = collections.defaultdict(collections.deque)

    def check_limit(self, user_id: int, limit: int, period_seconds: int = 60) -> bool:
        """
        Check if user has exceeded the rate limit.
        Returns True if request is ALLOWED, False if BLOCKED.
        """
        now = datetime.now(timezone.utc)
        timestamps = self.user_requests[user_id]
        
        # Remove old timestamps
        while timestamps and (now - timestamps[0]).total_seconds() > period_seconds:
            timestamps.popleft()
            
        # Check if limit reached
        if len(timestamps) < limit:
            timestamps.append(now)
            return True
        else:
            return False

# Global instance
rate_limiter = RateLimiter()
