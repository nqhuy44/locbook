import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
from src.core.rate_limiter import RateLimiter, rate_limiter

class TestRateLimiter(unittest.TestCase):
    def setUp(self):
        self.limiter = RateLimiter() # New instance for each test

    def test_allow_within_limit(self):
        user_id = 1
        limit = 5
        # 5 requests should be allowed
        for _ in range(limit):
            self.assertTrue(self.limiter.check_limit(user_id, limit))
        
        # 6th should be blocked
        self.assertFalse(self.limiter.check_limit(user_id, limit))

    def test_window_reset(self):
        user_id = 2
        limit = 1
        
        # 1st request allowed
        self.assertTrue(self.limiter.check_limit(user_id, limit))
        # 2nd blocked
        self.assertFalse(self.limiter.check_limit(user_id, limit))
        
        # Mock time moving forward by 61 seconds
        future = datetime.now(timezone.utc) + timedelta(seconds=61)
        with patch('src.core.rate_limiter.datetime') as mock_datetime:
            mock_datetime.now.return_value = future
            # Should be allowed now
            self.assertTrue(self.limiter.check_limit(user_id, limit))

if __name__ == "__main__":
    unittest.main()
