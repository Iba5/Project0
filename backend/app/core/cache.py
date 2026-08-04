import json
import logging
from typing import Optional, Any, Callable
from functools import wraps
from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """
    Redis-based caching service for frequently accessed data.
    Improves performance by reducing database queries for expensive operations.
    """
    
    def __init__(self):
        self._redis_client = None
        self._enabled = bool(settings.REDIS_URL and settings.REDIS_URL != "redis://localhost:6379/0")
        
    def _get_redis(self):
        """Initialize Redis client lazily."""
        if self._redis_client is None and self._enabled:
            try:
                import redis
                self._redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True
                )
                # Test connection
                self._redis_client.ping()
                logger.info("Redis cache initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Redis cache: {str(e)}")
                self._enabled = False
                self._redis_client = None
        return self._redis_client
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self._enabled:
            return None
            
        try:
            redis = self._get_redis()
            if redis:
                value = redis.get(key)
                if value:
                    return json.loads(value)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {str(e)}")
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL in seconds."""
        if not self._enabled:
            return False
            
        try:
            redis = self._get_redis()
            if redis:
                redis.setex(key, ttl, json.dumps(value))
                return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {str(e)}")
        return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self._enabled:
            return False
            
        try:
            redis = self._get_redis()
            if redis:
                redis.delete(key)
                return True
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {str(e)}")
        return False
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        if not self._enabled:
            return 0
            
        try:
            redis = self._get_redis()
            if redis:
                keys = redis.keys(pattern)
                if keys:
                    return redis.delete(*keys)
        except Exception as e:
            logger.error(f"Cache pattern invalidate error for {pattern}: {str(e)}")
        return 0
    
    def invalidate_events(self) -> int:
        """Invalidate all event-related cache keys."""
        if not self._enabled:
            return 0
            
        try:
            redis = self._get_redis()
            if redis:
                keys = redis.keys(f"{CACHE_PREFIXES['events']}:*")
                if keys:
                    return redis.delete(*keys)
        except Exception as e:
            logger.error(f"Cache events invalidate error: {str(e)}")
        return 0
    
    def clear_all(self) -> bool:
        """Clear all cache keys."""
        if not self._enabled:
            return False
            
        try:
            redis = self._get_redis()
            if redis:
                redis.flushdb()
                logger.info("Cache cleared successfully")
                return True
        except Exception as e:
            logger.error(f"Cache clear error: {str(e)}")
        return False


# Global cache instance
cache = CacheService()


def cached(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator to cache function results.
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache key (default: function name)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{key_prefix or func.__name__}"
            
            # Add function arguments to key for uniqueness
            if args or kwargs:
                key_suffix = str(hash(str(args) + str(kwargs)))
                cache_key = f"{cache_key}:{key_suffix}"
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


# Cache key patterns
CACHE_KEYS = {
    'leaderboard': 'leaderboard',
    'active_event': 'active_event',
    'payment_methods': 'payment_methods',
    'dashboard_summary': 'dashboard_summary',
    'participant_details': 'participant',
    'event_details': 'event',
}

# Cache TTL constants (in seconds)
CACHE_TTL = {
    'SHORT': 60,           # 1 minute
    'MEDIUM': 300,         # 5 minutes
    'LONG': 3600,          # 1 hour
    'DAILY': 86400,        # 24 hours
    'leaderboard': 300,    # 5 minutes
    'public_participants': 300,  # 5 minutes
}

# Cache key prefixes
CACHE_PREFIXES = {
    'leaderboard': 'leaderboard',
    'participants': 'participants',
    'public_participants': 'public_participants',
    'events': 'events',
    'stats': 'stats',
    'payment_methods': 'payment_methods',
}


def get_cache_service() -> CacheService:
    """Get the global cache service instance."""
    return cache


def get_cache_key(prefix: str, *args) -> str:
    """Generate a cache key from prefix and arguments."""
    key = f"{prefix}"
    if args:
        key_suffix = ":".join(str(arg) for arg in args)
        key = f"{key}:{key_suffix}"
    return key