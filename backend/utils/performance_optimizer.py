"""
Performance Optimization Utilities for AI VTuber System
Provides async processing, caching, connection pooling, and memory optimization.
"""

import asyncio
import aiohttp
import time
import json
import hashlib
from typing import Dict, Any, Optional, Callable, List
from functools import wraps
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading
import gc
import psutil
from services.lib.LAV_logger import logger


@dataclass
class CacheEntry:
    """Cache entry with TTL support"""
    data: Any
    timestamp: float
    ttl: float
    
    def is_expired(self) -> bool:
        return time.time() - self.timestamp > self.ttl


class AsyncCache:
    """Thread-safe async cache with TTL support"""
    
    def __init__(self, default_ttl: float = 300.0):  # 5 minutes default
        self.cache: Dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl
        self._lock = threading.RLock()
        
    def _generate_key(self, func_name: str, args: tuple, kwargs: dict) -> str:
        """Generate cache key from function name and arguments"""
        key_data = {
            'func': func_name,
            'args': args,
            'kwargs': sorted(kwargs.items())
        }
        key_str = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired"""
        with self._lock:
            entry = self.cache.get(key)
            if entry and not entry.is_expired():
                return entry.data
            elif entry:
                # Remove expired entry
                del self.cache[key]
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        """Set cached value with TTL"""
        with self._lock:
            self.cache[key] = CacheEntry(
                data=value,
                timestamp=time.time(),
                ttl=ttl or self.default_ttl
            )
    
    def clear_expired(self) -> int:
        """Clear expired entries and return count cleared"""
        with self._lock:
            expired_keys = [
                key for key, entry in self.cache.items()
                if entry.is_expired()
            ]
            for key in expired_keys:
                del self.cache[key]
            return len(expired_keys)
    
    def clear_all(self) -> None:
        """Clear all cached entries"""
        with self._lock:
            self.cache.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_entries = len(self.cache)
            expired_count = sum(1 for entry in self.cache.values() if entry.is_expired())
            return {
                'total_entries': total_entries,
                'active_entries': total_entries - expired_count,
                'expired_entries': expired_count,
                'cache_hit_ratio': getattr(self, '_hit_ratio', 0.0)
            }


class ConnectionPool:
    """Async HTTP connection pool manager"""
    
    def __init__(self, 
                 connector_limit: int = 100,
                 timeout: aiohttp.ClientTimeout = None):
        self.connector_limit = connector_limit
        self.timeout = timeout or aiohttp.ClientTimeout(total=30)
        self._session: Optional[aiohttp.ClientSession] = None
        self._lock = asyncio.Lock()
    
    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP client session"""
        if self._session is None or self._session.closed:
            async with self._lock:
                if self._session is None or self._session.closed:
                    connector = aiohttp.TCPConnector(
                        limit=self.connector_limit,
                        limit_per_host=20,
                        keepalive_timeout=60,
                        enable_cleanup_closed=True
                    )
                    self._session = aiohttp.ClientSession(
                        connector=connector,
                        timeout=self.timeout
                    )
        return self._session
    
    async def close(self):
        """Close the connection pool"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def __aenter__(self):
        return await self.get_session()
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Don't close session on context exit to allow reuse
        pass


class PerformanceOptimizer:
    """Main performance optimization manager"""
    
    def __init__(self):
        self.cache = AsyncCache()
        self.connection_pool = ConnectionPool()
        self.thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="perf_opt")
        self._cleanup_task: Optional[asyncio.Task] = None
        self._memory_monitor_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start background optimization tasks"""
        self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
        self._memory_monitor_task = asyncio.create_task(self._memory_monitor())
        logger.info("🚀 Performance optimizer started")
    
    async def stop(self):
        """Stop optimization tasks and cleanup"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._memory_monitor_task:
            self._memory_monitor_task.cancel()
        
        await self.connection_pool.close()
        self.thread_pool.shutdown(wait=True)
        logger.info("⚡ Performance optimizer stopped")
    
    async def _periodic_cleanup(self):
        """Periodic cache cleanup task"""
        while True:
            try:
                await asyncio.sleep(300)  # 5 minutes
                cleared = self.cache.clear_expired()
                if cleared > 0:
                    logger.debug(f"🧹 Cleared {cleared} expired cache entries")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")
    
    async def _memory_monitor(self):
        """Monitor memory usage and trigger GC if needed"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                process = psutil.Process()
                memory_percent = process.memory_percent()
                
                if memory_percent > 80:  # If using > 80% memory
                    logger.warning(f"🧠 High memory usage: {memory_percent:.1f}%")
                    # Force garbage collection
                    collected = gc.collect()
                    logger.info(f"🗑️ Garbage collected {collected} objects")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in memory monitor: {e}")


# Global performance optimizer instance
perf_optimizer = PerformanceOptimizer()


def async_cached(ttl: float = 300.0):
    """Decorator for caching async function results"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = perf_optimizer.cache._generate_key(
                func.__name__, args, kwargs
            )
            
            # Try to get from cache
            cached_result = perf_optimizer.cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            perf_optimizer.cache.set(cache_key, result, ttl)
            return result
        
        return wrapper
    return decorator


def sync_cached(ttl: float = 300.0):
    """Decorator for caching synchronous function results"""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = perf_optimizer.cache._generate_key(
                func.__name__, args, kwargs
            )
            
            # Try to get from cache
            cached_result = perf_optimizer.cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            perf_optimizer.cache.set(cache_key, result, ttl)
            return result
        
        return wrapper
    return decorator


async def run_in_thread(func: Callable, *args, **kwargs) -> Any:
    """Run synchronous function in thread pool"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        perf_optimizer.thread_pool, 
        lambda: func(*args, **kwargs)
    )


async def batch_process(items: List[Any], 
                       processor: Callable, 
                       batch_size: int = 10,
                       max_concurrent: int = 5) -> List[Any]:
    """Process items in batches with concurrency control"""
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def process_batch(batch):
        async with semaphore:
            if asyncio.iscoroutinefunction(processor):
                return await processor(batch)
            else:
                return await run_in_thread(processor, batch)
    
    # Split items into batches
    batches = [
        items[i:i + batch_size] 
        for i in range(0, len(items), batch_size)
    ]
    
    # Process all batches concurrently
    results = await asyncio.gather(*[
        process_batch(batch) for batch in batches
    ])
    
    # Flatten results
    flattened = []
    for batch_result in results:
        if isinstance(batch_result, list):
            flattened.extend(batch_result)
        else:
            flattened.append(batch_result)
    
    return flattened


class RetryManager:
    """Manage retry logic with exponential backoff"""
    
    @staticmethod
    async def retry_async(func: Callable,
                         max_retries: int = 3,
                         base_delay: float = 1.0,
                         max_delay: float = 60.0,
                         backoff_factor: float = 2.0,
                         exceptions: tuple = (Exception,)) -> Any:
        """Retry async function with exponential backoff"""
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                return await func()
            except exceptions as e:
                last_exception = e
                if attempt == max_retries:
                    break
                
                delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                logger.warning(f"🔄 Retry attempt {attempt + 1}/{max_retries + 1} after {delay:.1f}s: {e}")
                await asyncio.sleep(delay)
        
        raise last_exception


class MemoryOptimizer:
    """Memory usage optimization utilities"""
    
    @staticmethod
    def get_memory_usage() -> Dict[str, float]:
        """Get current memory usage statistics"""
        process = psutil.Process()
        memory_info = process.memory_info()
        memory_percent = process.memory_percent()
        
        return {
            'rss_mb': memory_info.rss / 1024 / 1024,  # Resident Set Size
            'vms_mb': memory_info.vms / 1024 / 1024,  # Virtual Memory Size
            'percent': memory_percent,
            'available_mb': psutil.virtual_memory().available / 1024 / 1024
        }
    
    @staticmethod
    def force_gc() -> int:
        """Force garbage collection and return objects collected"""
        return gc.collect()
    
    @staticmethod
    def get_gc_stats() -> Dict[str, Any]:
        """Get garbage collection statistics"""
        return {
            'collections': gc.get_stats(),
            'counts': gc.get_count(),
            'threshold': gc.get_threshold()
        }


# Export main components
__all__ = [
    'perf_optimizer',
    'async_cached',
    'sync_cached', 
    'run_in_thread',
    'batch_process',
    'RetryManager',
    'MemoryOptimizer',
    'ConnectionPool'
]