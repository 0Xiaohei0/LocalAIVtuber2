import asyncio
import time
from typing import Dict, Any, Optional
from services.lib.LAV_logger import logger
from utils.performance_optimizer import (
    perf_optimizer,
    async_cached,
    sync_cached,
    run_in_thread,
    RetryManager,
    MemoryOptimizer
)

from .GPTsovits.GptSovits import GptSovits

class TTS:
    def __init__(self):
        self.tts_engine = GptSovits()
        self.current_voice = "leaf"
        
        # Performance optimization settings
        self.enable_caching = True
        self.cache_ttl = 300.0  # 5 minutes
        self.async_processing = True
        
        # Performance statistics
        self._synthesis_times: Dict[str, float] = {}
        self._cache_stats = {'hits': 0, 'misses': 0}

    @sync_cached(ttl=600.0)  # Cache voice list for 10 minutes
    def get_available_voices(self):
        """Get list of available voices from the models directory (cached)"""
        start_time = time.time()
        voices = self.tts_engine.get_available_voices()
        load_time = time.time() - start_time
        logger.debug(f"⚡ Voice list loaded in {load_time:.2f}s")
        return voices

    async def get_available_voices_async(self):
        """Async version of get_available_voices"""
        return await run_in_thread(self.get_available_voices)

    @sync_cached(ttl=300.0)  # Cache voice changes for 5 minutes
    def change_voice(self, voice_name):
        """Change the current voice to the specified one (cached)"""
        start_time = time.time()
        
        try:
            result = self.tts_engine.change_voice(voice_name)
            if result:
                self.current_voice = voice_name
                change_time = time.time() - start_time
                logger.info(f"🎵 Voice changed to '{voice_name}' in {change_time:.2f}s")
            return result
        except Exception as e:
            logger.error(f"❌ Failed to change voice to '{voice_name}': {e}")
            return False

    async def change_voice_async(self, voice_name):
        """Async version of change_voice with retry logic"""
        async def _change_voice():
            return await run_in_thread(self.change_voice, voice_name)
        
        return await RetryManager.retry_async(
            _change_voice,
            max_retries=2,
            exceptions=(Exception,)
        )

    @async_cached(ttl=300.0)  # Cache synthesis results for 5 minutes
    async def synthesize_async(self, text: str) -> bytes:
        """Async text-to-speech synthesis with caching and performance monitoring"""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        start_time = time.time()
        
        async def _synthesize():
            if hasattr(self.tts_engine, 'synthesize_async'):
                return await self.tts_engine.synthesize_async(text)
            else:
                return await run_in_thread(self.tts_engine.synthesize, text)
        
        try:
            # Use retry logic for robust synthesis
            audio_data = await RetryManager.retry_async(
                _synthesize,
                max_retries=2,
                exceptions=(Exception,)
            )
            
            # Record performance metrics
            synthesis_time = time.time() - start_time
            self._synthesis_times[self.current_voice] = synthesis_time
            
            logger.info(f"🎵 Text synthesized with '{self.current_voice}' in {synthesis_time:.2f}s")
            return audio_data
            
        except Exception as e:
            logger.error(f"❌ Synthesis failed: {e}")
            raise

    def synthesize(self, text):
        """Synchronous text-to-speech synthesis with performance monitoring"""
        start_time = time.time()
        
        try:
            audio_data = self.tts_engine.synthesize(text)
            synthesis_time = time.time() - start_time
            self._synthesis_times[self.current_voice] = synthesis_time
            
            logger.debug(f"🎵 Text synthesized in {synthesis_time:.2f}s")
            return audio_data
            
        except Exception as e:
            logger.error(f"❌ Synthesis failed: {e}")
            raise
    
    async def upload_voice_async(self, name, reference_audio, reference_text, reference_language):
        """Async voice upload with retry logic"""
        async def _upload():
            return await run_in_thread(
                self.tts_engine.upload_voice,
                name, reference_audio, reference_text, reference_language
            )
        
        return await RetryManager.retry_async(
            _upload,
            max_retries=2,
            exceptions=(Exception,)
        )
    
    def upload_voice(self, name, reference_audio, reference_text, reference_language):
        """Upload a new voice with reference audio and text"""
        start_time = time.time()
        
        try:
            result = self.tts_engine.upload_voice(name, reference_audio, reference_text, reference_language)
            upload_time = time.time() - start_time
            
            if result:
                logger.info(f"🎤 Voice '{name}' uploaded successfully in {upload_time:.2f}s")
                # Clear voice cache to include new voice
                perf_optimizer.cache.clear_expired()
            else:
                logger.error(f"❌ Failed to upload voice '{name}'")
                
            return result
        except Exception as e:
            logger.error(f"❌ Voice upload failed: {e}")
            return False
    
    async def delete_voice_async(self, name):
        """Async voice deletion"""
        return await run_in_thread(self.delete_voice, name)
    
    def delete_voice(self, name):
        """Delete a voice and clear related cache"""
        try:
            result = self.tts_engine.delete_voice(name)
            if result:
                logger.info(f"🗑️ Voice '{name}' deleted successfully")
                # Clear caches that might contain this voice
                perf_optimizer.cache.clear_expired()
            return result
        except Exception as e:
            logger.error(f"❌ Failed to delete voice '{name}': {e}")
            return False

    def get_performance_stats(self) -> Dict[str, Any]:
        """Get TTS performance statistics"""
        return {
            'current_voice': self.current_voice,
            'synthesis_times': self._synthesis_times,
            'cache_stats': perf_optimizer.cache.get_stats(),
            'memory_usage': MemoryOptimizer.get_memory_usage(),
            'cache_enabled': self.enable_caching,
            'async_processing': self.async_processing
        }
    
    def optimize_performance(self):
        """Trigger performance optimization"""
        # Clear expired cache entries
        cleared = perf_optimizer.cache.clear_expired()
        
        # Force garbage collection
        collected = MemoryOptimizer.force_gc()
        
        logger.info(f"🚀 Performance optimization: cleared {cleared} cache entries, collected {collected} objects")
        
        return {
            'cache_cleared': cleared,
            'objects_collected': collected,
            'memory_usage': MemoryOptimizer.get_memory_usage()
        }
    