"""
ElevenLabs TTS Provider for High-Quality Cloud Voice Synthesis
Supports voice cloning, real-time audio streaming, and multiple voice models.
"""

import asyncio
import json
import time
import io
from typing import Dict, Any, List, Optional, AsyncIterator
from dataclasses import dataclass
from services.lib.LAV_logger import logger
from utils.performance_optimizer import (
    perf_optimizer,
    async_cached,
    RetryManager,
    MemoryOptimizer
)
import aiohttp
import os
from datetime import datetime, timedelta


@dataclass
class ElevenLabsConfig:
    """Configuration for ElevenLabs API"""
    api_key: str
    base_url: str = "https://api.elevenlabs.io/v1"
    default_voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
    model_id: str = "eleven_multilingual_v2"
    stability: float = 0.5
    similarity_boost: float = 0.5
    style: float = 0.0
    use_speaker_boost: bool = True
    optimize_streaming_latency: int = 0
    output_format: str = "mp3_44100_128"
    timeout: int = 30
    max_retries: int = 3
    rate_limit_rpm: int = 200  # Requests per minute


class VoiceSettings:
    """Voice synthesis settings"""
    
    def __init__(self, 
                 stability: float = 0.5,
                 similarity_boost: float = 0.5,
                 style: float = 0.0,
                 use_speaker_boost: bool = True):
        self.stability = max(0.0, min(1.0, stability))
        self.similarity_boost = max(0.0, min(1.0, similarity_boost))
        self.style = max(0.0, min(1.0, style))
        self.use_speaker_boost = use_speaker_boost
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'stability': self.stability,
            'similarity_boost': self.similarity_boost,
            'style': self.style,
            'use_speaker_boost': self.use_speaker_boost
        }


class RateLimiter:
    """Rate limiter for ElevenLabs API requests"""
    
    def __init__(self, max_requests: int, time_window: int = 60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = []
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        async with self._lock:
            now = datetime.now()
            self.requests = [
                req_time for req_time in self.requests
                if now - req_time < timedelta(seconds=self.time_window)
            ]
            
            if len(self.requests) < self.max_requests:
                self.requests.append(now)
                return True
            return False
    
    async def wait_if_needed(self):
        while not await self.acquire():
            await asyncio.sleep(1)


class ElevenLabsProvider:
    """ElevenLabs TTS Provider with advanced features"""
    
    def __init__(self, config: ElevenLabsConfig):
        self.config = config
        self.rate_limiter = RateLimiter(config.rate_limit_rpm)
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Statistics
        self.request_count = 0
        self.total_characters_synthesized = 0
        self.total_audio_generated_seconds = 0.0
        self.voice_cache: Dict[str, Dict] = {}
        
        if not config.api_key:
            raise ValueError("ElevenLabs API key is required")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session
    
    async def close(self):
        """Close HTTP session"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def _make_request(self, 
                          method: str, 
                          endpoint: str, 
                          data: Any = None,
                          json_data: Dict = None,
                          stream: bool = False) -> aiohttp.ClientResponse:
        """Make HTTP request to ElevenLabs API"""
        await self.rate_limiter.wait_if_needed()
        
        session = await self._get_session()
        headers = {
            'xi-api-key': self.config.api_key,
            'User-Agent': 'NEX-ARIS-AI-VTuber/1.0',
            'Accept': 'audio/mpeg' if not stream else '*/*'
        }
        
        if json_data:
            headers['Content-Type'] = 'application/json'
        
        url = f"{self.config.base_url}/{endpoint}"
        
        async def _request():
            async with session.request(
                method, 
                url, 
                headers=headers,
                data=data,
                json=json_data
            ) as response:
                if response.status not in [200, 201]:
                    error_text = await response.text()
                    raise aiohttp.ClientError(
                        f"ElevenLabs API error {response.status}: {error_text}"
                    )
                return response
        
        response = await RetryManager.retry_async(
            _request,
            max_retries=self.config.max_retries,
            exceptions=(aiohttp.ClientError, asyncio.TimeoutError)
        )
        
        self.request_count += 1
        return response
    
    @async_cached(ttl=3600.0)  # Cache for 1 hour
    async def get_available_voices(self) -> List[Dict[str, Any]]:
        """Get list of available voices"""
        logger.debug("🎤 Fetching available voices from ElevenLabs")
        
        try:
            response = await self._make_request('GET', 'voices')
            result = await response.json()
            
            voices = []
            for voice in result.get('voices', []):
                voice_info = {
                    'voice_id': voice['voice_id'],
                    'name': voice['name'],
                    'category': voice.get('category', 'Unknown'),
                    'description': voice.get('description', ''),
                    'preview_url': voice.get('preview_url'),
                    'settings': voice.get('settings', {}),
                    'labels': voice.get('labels', {}),
                    'available_for_tiers': voice.get('available_for_tiers', [])
                }
                voices.append(voice_info)
                
                # Cache voice info
                self.voice_cache[voice['voice_id']] = voice_info
            
            logger.info(f"🎤 Found {len(voices)} available voices")
            return voices
            
        except Exception as e:
            logger.error(f"❌ Failed to get voices: {e}")
            raise
    
    async def get_voice(self, voice_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific voice"""
        # Check cache first
        if voice_id in self.voice_cache:
            return self.voice_cache[voice_id]
        
        try:
            response = await self._make_request('GET', f'voices/{voice_id}')
            voice_info = await response.json()
            
            # Cache the result
            self.voice_cache[voice_id] = voice_info
            return voice_info
            
        except Exception as e:
            logger.error(f"❌ Failed to get voice {voice_id}: {e}")
            raise
    
    @async_cached(ttl=300.0)  # Cache for 5 minutes
    async def synthesize_text(self, 
                            text: str,
                            voice_id: str = None,
                            voice_settings: VoiceSettings = None,
                            model_id: str = None) -> bytes:
        """Synthesize text to speech"""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        voice_id = voice_id or self.config.default_voice_id
        model_id = model_id or self.config.model_id
        voice_settings = voice_settings or VoiceSettings(
            stability=self.config.stability,
            similarity_boost=self.config.similarity_boost,
            style=self.config.style,
            use_speaker_boost=self.config.use_speaker_boost
        )
        
        logger.debug(f"🎵 Synthesizing text with voice {voice_id}: '{text[:50]}...'")
        start_time = time.time()
        
        try:
            request_data = {
                'text': text,
                'model_id': model_id,
                'voice_settings': voice_settings.to_dict()
            }
            
            response = await self._make_request(
                'POST',
                f'text-to-speech/{voice_id}',
                json_data=request_data
            )
            
            audio_data = await response.read()
            
            # Update statistics
            synthesis_time = time.time() - start_time
            self.total_characters_synthesized += len(text)
            
            # Estimate audio duration (rough approximation)
            estimated_duration = len(text) / 150.0  # ~150 chars per minute
            self.total_audio_generated_seconds += estimated_duration
            
            logger.info(f"🎵 Text synthesized in {synthesis_time:.2f}s, "
                       f"audio size: {len(audio_data)} bytes")
            
            return audio_data
            
        except Exception as e:
            logger.error(f"❌ Text synthesis failed: {e}")
            raise
    
    async def synthesize_text_stream(self,
                                   text: str,
                                   voice_id: str = None,
                                   voice_settings: VoiceSettings = None,
                                   model_id: str = None) -> AsyncIterator[bytes]:
        """Synthesize text to speech with streaming"""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        voice_id = voice_id or self.config.default_voice_id
        model_id = model_id or self.config.model_id
        voice_settings = voice_settings or VoiceSettings()
        
        logger.debug(f"🌊 Starting streaming synthesis with voice {voice_id}")
        start_time = time.time()
        
        try:
            request_data = {
                'text': text,
                'model_id': model_id,
                'voice_settings': voice_settings.to_dict(),
                'optimize_streaming_latency': self.config.optimize_streaming_latency,
                'output_format': self.config.output_format
            }
            
            response = await self._make_request(
                'POST',
                f'text-to-speech/{voice_id}/stream',
                json_data=request_data,
                stream=True
            )
            
            # Stream audio data chunks
            async for chunk in response.content.iter_chunked(8192):
                if chunk:
                    yield chunk
            
            synthesis_time = time.time() - start_time
            self.total_characters_synthesized += len(text)
            
            logger.info(f"🌊 Streaming synthesis completed in {synthesis_time:.2f}s")
            
        except Exception as e:
            logger.error(f"❌ Streaming synthesis failed: {e}")
            raise
    
    async def clone_voice(self,
                        name: str,
                        description: str,
                        files: List[bytes],
                        labels: Dict[str, str] = None) -> Dict[str, Any]:
        """Clone a voice from audio samples"""
        logger.info(f"🧬 Cloning voice '{name}' from {len(files)} audio samples")
        
        try:
            # Prepare multipart form data
            data = aiohttp.FormData()
            data.add_field('name', name)
            data.add_field('description', description)
            
            if labels:
                data.add_field('labels', json.dumps(labels))
            
            # Add audio files
            for i, file_data in enumerate(files):
                data.add_field(
                    'files',
                    io.BytesIO(file_data),
                    filename=f'sample_{i}.mp3',
                    content_type='audio/mpeg'
                )
            
            response = await self._make_request('POST', 'voices/add', data=data)
            result = await response.json()
            
            voice_id = result.get('voice_id')
            logger.info(f"🧬 Voice '{name}' cloned successfully with ID: {voice_id}")
            
            # Clear voice cache to include new voice
            self.voice_cache.clear()
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Voice cloning failed: {e}")
            raise
    
    async def delete_voice(self, voice_id: str) -> bool:
        """Delete a cloned voice"""
        try:
            await self._make_request('DELETE', f'voices/{voice_id}')
            
            # Remove from cache
            self.voice_cache.pop(voice_id, None)
            
            logger.info(f"🗑️ Voice {voice_id} deleted successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete voice {voice_id}: {e}")
            return False
    
    async def get_user_info(self) -> Dict[str, Any]:
        """Get user account information and usage stats"""
        try:
            response = await self._make_request('GET', 'user')
            return await response.json()
        except Exception as e:
            logger.error(f"❌ Failed to get user info: {e}")
            raise
    
    async def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics"""
        try:
            user_info = await self.get_user_info()
            subscription = user_info.get('subscription', {})
            
            return {
                'character_count': subscription.get('character_count', 0),
                'character_limit': subscription.get('character_limit', 0),
                'can_extend_character_limit': subscription.get('can_extend_character_limit', False),
                'allowed_to_extend_character_limit': subscription.get('allowed_to_extend_character_limit', False),
                'next_character_count_reset_unix': subscription.get('next_character_count_reset_unix', 0),
                'voice_limit': subscription.get('voice_limit', 0),
                'max_voice_add_edits': subscription.get('max_voice_add_edits', 0),
                'voice_add_edit_counter': subscription.get('voice_add_edit_counter', 0),
                'professional_voice_limit': subscription.get('professional_voice_limit', 0),
                'can_extend_voice_limit': subscription.get('can_extend_voice_limit', False),
                'can_use_instant_voice_cloning': subscription.get('can_use_instant_voice_cloning', False),
                'can_use_professional_voice_cloning': subscription.get('can_use_professional_voice_cloning', False),
                'tier': subscription.get('tier', 'free')
            }
        except Exception as e:
            logger.error(f"❌ Failed to get usage stats: {e}")
            return {}
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get provider statistics"""
        return {
            'provider': 'ElevenLabs',
            'request_count': self.request_count,
            'total_characters_synthesized': self.total_characters_synthesized,
            'total_audio_generated_seconds': self.total_audio_generated_seconds,
            'cached_voices': len(self.voice_cache),
            'default_voice_id': self.config.default_voice_id,
            'model_id': self.config.model_id,
            'rate_limit_rpm': self.config.rate_limit_rpm,
            'memory_usage': MemoryOptimizer.get_memory_usage()
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check API health and connectivity"""
        try:
            start_time = time.time()
            
            # Test with a simple request
            await self.get_user_info()
            
            response_time = time.time() - start_time
            
            return {
                'status': 'healthy',
                'response_time_ms': response_time * 1000,
                'provider': 'ElevenLabs'
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'response_time_ms': None,
                'provider': 'ElevenLabs'
            }


# Factory function for easy provider creation
def create_elevenlabs_provider(api_key: str = None, **config_kwargs) -> ElevenLabsProvider:
    """Create ElevenLabs provider with configuration"""
    if api_key is None:
        api_key = os.getenv('ELEVENLABS_API_KEY')
    
    if not api_key:
        raise ValueError("ElevenLabs API key must be provided or set in ELEVENLABS_API_KEY environment variable")
    
    config = ElevenLabsConfig(api_key=api_key, **config_kwargs)
    return ElevenLabsProvider(config)


# Export main components
__all__ = ['ElevenLabsProvider', 'ElevenLabsConfig', 'VoiceSettings', 'create_elevenlabs_provider']