"""
Enhanced TTS Manager for unified local and cloud TTS provider management
Handles failover, load balancing, and intelligent provider selection.
"""

import asyncio
import time
from typing import Dict, Any, List, Optional, Union, AsyncIterator
from enum import Enum
from dataclasses import dataclass
from services.lib.LAV_logger import logger
from utils.performance_optimizer import (
    perf_optimizer,
    async_cached,
    RetryManager,
    MemoryOptimizer
)

from .providers.ElevenLabsProvider import ElevenLabsProvider, create_elevenlabs_provider, VoiceSettings


class TTSProviderType(Enum):
    LOCAL = "local"
    CLOUD = "cloud"


class TTSProviderStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    DISABLED = "disabled"


@dataclass
class TTSProviderConfig:
    """Configuration for a TTS provider"""
    name: str
    type: TTSProviderType
    enabled: bool = True
    priority: int = 1  # Lower number = higher priority
    supports_streaming: bool = False
    supports_voice_cloning: bool = False
    max_text_length: int = 5000
    timeout: int = 30
    health_check_interval: int = 300  # 5 minutes
    failure_threshold: int = 3
    recovery_threshold: int = 2


@dataclass
class TTSProviderHealth:
    """TTS Provider health status"""
    status: TTSProviderStatus
    last_check: float
    response_time_ms: float
    failure_count: int
    success_count: int
    last_error: Optional[str] = None


class EnhancedTTSManager:
    """Unified manager for local and cloud TTS providers"""
    
    def __init__(self, local_tts_instance=None):
        self.local_tts = local_tts_instance
        self.providers: Dict[str, Any] = {}
        self.provider_configs: Dict[str, TTSProviderConfig] = {}
        self.provider_health: Dict[str, TTSProviderHealth] = {}
        
        # Configuration
        self.auto_failover = True
        self.load_balancing = True
        self.health_monitoring = True
        self.prefer_cloud_for_quality = True
        
        # Statistics
        self.request_count = 0
        self.failover_count = 0
        self.total_response_time = 0.0
        self.total_characters_synthesized = 0
        
        # Background tasks
        self._health_check_task: Optional[asyncio.Task] = None
        
        # Initialize local provider if available
        if self.local_tts:
            self._register_local_provider()
        
        logger.info("🎵 Enhanced TTS Manager initialized")
    
    def _register_local_provider(self):
        """Register the local TTS provider"""
        config = TTSProviderConfig(
            name="local",
            type=TTSProviderType.LOCAL,
            priority=2,  # Lower priority than cloud by default
            enabled=True,
            supports_streaming=False,
            supports_voice_cloning=False,
            max_text_length=10000
        )
        
        health = TTSProviderHealth(
            status=TTSProviderStatus.HEALTHY,
            last_check=time.time(),
            response_time_ms=0.0,
            failure_count=0,
            success_count=0
        )
        
        self.provider_configs["local"] = config
        self.provider_health["local"] = health
        self.providers["local"] = self.local_tts
        
        logger.info("🏠 Local TTS provider registered")
    
    async def register_cloud_provider(self, 
                                    name: str, 
                                    provider_type: str,
                                    config: Dict[str, Any]) -> bool:
        """Register a cloud TTS provider"""
        try:
            if provider_type.lower() == "elevenlabs":
                provider = create_elevenlabs_provider(**config)
                
                # Test provider health
                health_result = await provider.health_check()
                if health_result['status'] != 'healthy':
                    logger.error(f"❌ Cloud TTS provider '{name}' failed health check: {health_result}")
                    return False
                
                # Create provider configuration
                provider_config = TTSProviderConfig(
                    name=name,
                    type=TTSProviderType.CLOUD,
                    priority=1,  # Cloud providers get higher priority for quality
                    enabled=True,
                    supports_streaming=True,
                    supports_voice_cloning=True,
                    max_text_length=config.get('max_text_length', 5000),
                    timeout=config.get('timeout', 30)
                )
                
                provider_health = TTSProviderHealth(
                    status=TTSProviderStatus.HEALTHY,
                    last_check=time.time(),
                    response_time_ms=health_result.get('response_time_ms', 0),
                    failure_count=0,
                    success_count=1
                )
                
                self.providers[name] = provider
                self.provider_configs[name] = provider_config
                self.provider_health[name] = provider_health
                
                logger.info(f"☁️ Cloud TTS provider '{name}' registered successfully")
                return True
            
            else:
                logger.error(f"❌ Unsupported TTS provider type: {provider_type}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to register cloud TTS provider '{name}': {e}")
            return False
    
    def get_available_providers(self) -> List[str]:
        """Get list of available and healthy providers"""
        available = []
        for name, config in self.provider_configs.items():
            if (config.enabled and 
                self.provider_health[name].status in [TTSProviderStatus.HEALTHY, TTSProviderStatus.DEGRADED]):
                available.append(name)
        
        # Sort by priority (lower numbers first)
        available.sort(key=lambda x: self.provider_configs[x].priority)
        return available
    
    def select_best_provider(self, 
                           text_length: int = 0,
                           require_streaming: bool = False,
                           require_voice_cloning: bool = False,
                           preferred_type: Optional[TTSProviderType] = None,
                           exclude: List[str] = None) -> Optional[str]:
        """Select the best available provider based on requirements"""
        exclude = exclude or []
        available = [p for p in self.get_available_providers() if p not in exclude]
        
        if not available:
            return None
        
        # Filter by requirements
        filtered_providers = []
        for provider_name in available:
            config = self.provider_configs[provider_name]
            
            # Check text length limit
            if text_length > config.max_text_length:
                continue
            
            # Check streaming requirement
            if require_streaming and not config.supports_streaming:
                continue
            
            # Check voice cloning requirement
            if require_voice_cloning and not config.supports_voice_cloning:
                continue
            
            # Check preferred type
            if preferred_type and config.type != preferred_type:
                continue
            
            filtered_providers.append(provider_name)
        
        if not filtered_providers:
            # Fallback to any available provider if requirements are too strict
            filtered_providers = available
        
        # Quality-based selection
        if self.prefer_cloud_for_quality:
            # Prefer cloud providers for better quality
            cloud_providers = [
                p for p in filtered_providers 
                if self.provider_configs[p].type == TTSProviderType.CLOUD
            ]
            if cloud_providers:
                filtered_providers = cloud_providers
        
        # Select based on health and response time
        best_provider = None
        best_score = float('inf')
        
        for provider_name in filtered_providers:
            health = self.provider_health[provider_name]
            config = self.provider_configs[provider_name]
            
            # Calculate score (lower is better)
            score = (
                config.priority * 100 +  # Priority weight
                health.response_time_ms +  # Response time weight
                health.failure_count * 50  # Failure penalty
            )
            
            if score < best_score:
                best_score = score
                best_provider = provider_name
        
        return best_provider
    
    async def _update_provider_health(self, 
                                    provider_name: str, 
                                    success: bool, 
                                    response_time_ms: float = 0, 
                                    error: str = None):
        """Update provider health statistics"""
        health = self.provider_health.get(provider_name)
        if not health:
            return
        
        health.last_check = time.time()
        health.response_time_ms = (health.response_time_ms + response_time_ms) / 2  # Moving average
        
        if success:
            health.success_count += 1
            health.failure_count = max(0, health.failure_count - 1)  # Gradual recovery
            
            if health.failure_count == 0:
                health.status = TTSProviderStatus.HEALTHY
            elif health.failure_count < self.provider_configs[provider_name].failure_threshold:
                health.status = TTSProviderStatus.DEGRADED
                
        else:
            health.failure_count += 1
            health.last_error = error
            
            config = self.provider_configs[provider_name]
            if health.failure_count >= config.failure_threshold:
                health.status = TTSProviderStatus.UNHEALTHY
                logger.warning(f"⚠️ TTS Provider '{provider_name}' marked as unhealthy")
            else:
                health.status = TTSProviderStatus.DEGRADED
    
    @async_cached(ttl=300.0)  # Cache for 5 minutes
    async def synthesize_text(self, 
                            text: str,
                            voice_id: str = None,
                            voice_settings: Dict[str, Any] = None,
                            preferred_provider: str = None,
                            **kwargs) -> bytes:
        """Synthesize text to speech with provider selection and failover"""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        start_time = time.time()
        self.request_count += 1
        self.total_characters_synthesized += len(text)
        
        # Select provider
        if preferred_provider and preferred_provider in self.providers:
            selected_provider = preferred_provider
        else:
            selected_provider = self.select_best_provider(
                text_length=len(text),
                **kwargs
            )
        
        if not selected_provider:
            raise RuntimeError("No available TTS providers")
        
        tried_providers = []
        last_error = None
        
        while selected_provider and selected_provider not in tried_providers:
            tried_providers.append(selected_provider)
            provider = self.providers[selected_provider]
            config = self.provider_configs[selected_provider]
            
            try:
                logger.debug(f"🎵 Trying provider '{selected_provider}' for TTS synthesis")
                
                if config.type == TTSProviderType.CLOUD:
                    # Cloud provider (ElevenLabs)
                    if voice_settings:
                        settings = VoiceSettings(**voice_settings)
                    else:
                        settings = None
                    
                    audio_data = await provider.synthesize_text(
                        text=text,
                        voice_id=voice_id,
                        voice_settings=settings,
                        **kwargs
                    )
                else:
                    # Local provider
                    if hasattr(provider, 'synthesize_async'):
                        audio_data = await provider.synthesize_async(text)
                    else:
                        from utils.performance_optimizer import run_in_thread
                        audio_data = await run_in_thread(provider.synthesize, text)
                
                # Update health statistics
                response_time = time.time() - start_time
                await self._update_provider_health(
                    selected_provider, 
                    success=True, 
                    response_time_ms=response_time * 1000
                )
                
                self.total_response_time += response_time
                
                logger.info(f"✅ TTS synthesis completed by '{selected_provider}' in {response_time:.2f}s, "
                           f"audio size: {len(audio_data)} bytes")
                
                return audio_data
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"⚠️ TTS Provider '{selected_provider}' failed: {e}")
                
                # Update health statistics
                await self._update_provider_health(
                    selected_provider, 
                    success=False, 
                    error=last_error
                )
                
                # Select next provider for failover
                if self.auto_failover:
                    selected_provider = self.select_best_provider(
                        text_length=len(text),
                        exclude=tried_providers,
                        **kwargs
                    )
                    if selected_provider:
                        self.failover_count += 1
                        logger.info(f"🔄 Failing over to TTS provider '{selected_provider}'")
                else:
                    break
        
        # All providers failed
        error_msg = f"All TTS providers failed. Last error: {last_error}"
        logger.error(f"❌ {error_msg}")
        raise RuntimeError(error_msg)
    
    async def synthesize_text_stream(self,
                                   text: str,
                                   voice_id: str = None,
                                   voice_settings: Dict[str, Any] = None,
                                   preferred_provider: str = None,
                                   **kwargs) -> AsyncIterator[bytes]:
        """Synthesize text to speech with streaming"""
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # Select streaming-capable provider
        if preferred_provider and preferred_provider in self.providers:
            selected_provider = preferred_provider
        else:
            selected_provider = self.select_best_provider(
                text_length=len(text),
                require_streaming=True,
                **kwargs
            )
        
        if not selected_provider:
            # Fallback to regular synthesis if no streaming provider available
            audio_data = await self.synthesize_text(text, voice_id, voice_settings, **kwargs)
            yield audio_data
            return
        
        provider = self.providers[selected_provider]
        config = self.provider_configs[selected_provider]
        
        try:
            logger.debug(f"🌊 Starting streaming TTS synthesis with '{selected_provider}'")
            
            if config.type == TTSProviderType.CLOUD and hasattr(provider, 'synthesize_text_stream'):
                if voice_settings:
                    settings = VoiceSettings(**voice_settings)
                else:
                    settings = None
                
                async for chunk in provider.synthesize_text_stream(
                    text=text,
                    voice_id=voice_id,
                    voice_settings=settings,
                    **kwargs
                ):
                    yield chunk
            else:
                # Fallback to regular synthesis
                audio_data = await self.synthesize_text(text, voice_id, voice_settings, **kwargs)
                yield audio_data
                
        except Exception as e:
            logger.error(f"❌ Streaming TTS synthesis failed: {e}")
            await self._update_provider_health(selected_provider, success=False, error=str(e))
            raise
    
    async def get_available_voices(self, provider_name: str = None) -> Dict[str, List[Dict[str, Any]]]:
        """Get available voices from all or specific providers"""
        if provider_name:
            if provider_name not in self.providers:
                raise ValueError(f"Provider '{provider_name}' not found")
            
            provider = self.providers[provider_name]
            config = self.provider_configs[provider_name]
            
            if config.type == TTSProviderType.CLOUD:
                voices = await provider.get_available_voices()
            else:
                voices = provider.get_available_voices() if hasattr(provider, 'get_available_voices') else []
            
            return {provider_name: voices}
        
        else:
            # Get voices from all providers
            all_voices = {}
            for name, provider in self.providers.items():
                config = self.provider_configs[name]
                try:
                    if config.type == TTSProviderType.CLOUD:
                        voices = await provider.get_available_voices()
                    else:
                        voices = provider.get_available_voices() if hasattr(provider, 'get_available_voices') else []
                    
                    all_voices[name] = voices
                except Exception as e:
                    logger.warning(f"⚠️ Failed to get voices from '{name}': {e}")
                    all_voices[name] = []
            
            return all_voices
    
    async def clone_voice(self,
                        provider_name: str,
                        name: str,
                        description: str,
                        audio_samples: List[bytes],
                        labels: Dict[str, str] = None) -> Dict[str, Any]:
        """Clone a voice using a specific provider"""
        if provider_name not in self.providers:
            raise ValueError(f"Provider '{provider_name}' not found")
        
        provider = self.providers[provider_name]
        config = self.provider_configs[provider_name]
        
        if not config.supports_voice_cloning:
            raise ValueError(f"Provider '{provider_name}' does not support voice cloning")
        
        try:
            result = await provider.clone_voice(
                name=name,
                description=description,
                files=audio_samples,
                labels=labels
            )
            
            logger.info(f"🧬 Voice '{name}' cloned successfully using '{provider_name}'")
            return result
            
        except Exception as e:
            logger.error(f"❌ Voice cloning failed on '{provider_name}': {e}")
            raise
    
    async def start_health_monitoring(self):
        """Start background health monitoring"""
        if self._health_check_task:
            self._health_check_task.cancel()
        
        self._health_check_task = asyncio.create_task(self._health_monitor_loop())
        logger.info("🏥 TTS Health monitoring started")
    
    async def stop_health_monitoring(self):
        """Stop background health monitoring"""
        if self._health_check_task:
            self._health_check_task.cancel()
            self._health_check_task = None
        logger.info("🏥 TTS Health monitoring stopped")
    
    async def _health_monitor_loop(self):
        """Background health monitoring loop"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._perform_health_checks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Error in TTS health monitoring: {e}")
    
    async def _perform_health_checks(self):
        """Perform health checks on all providers"""
        for name, provider in self.providers.items():
            config = self.provider_configs[name]
            health = self.provider_health[name]
            
            # Skip if recently checked
            if time.time() - health.last_check < config.health_check_interval:
                continue
            
            try:
                if config.type == TTSProviderType.CLOUD:
                    health_result = await provider.health_check()
                    success = health_result['status'] == 'healthy'
                    response_time = health_result.get('response_time_ms', 0)
                    error = health_result.get('error')
                else:
                    # Simple health check for local provider
                    success = bool(provider)
                    response_time = 0
                    error = None
                
                await self._update_provider_health(name, success, response_time, error)
                
            except Exception as e:
                await self._update_provider_health(name, success=False, error=str(e))
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive TTS statistics"""
        avg_response_time = (self.total_response_time / self.request_count 
                           if self.request_count > 0 else 0)
        
        provider_stats = {}
        for name, health in self.provider_health.items():
            config = self.provider_configs[name]
            provider = self.providers[name]
            
            provider_info = {
                'type': config.type.value,
                'status': health.status.value,
                'priority': config.priority,
                'enabled': config.enabled,
                'supports_streaming': config.supports_streaming,
                'supports_voice_cloning': config.supports_voice_cloning,
                'response_time_ms': health.response_time_ms,
                'failure_count': health.failure_count,
                'success_count': health.success_count,
                'last_check': health.last_check,
                'last_error': health.last_error
            }
            
            # Add provider-specific stats
            if hasattr(provider, 'get_statistics'):
                provider_info['provider_stats'] = provider.get_statistics()
            
            provider_stats[name] = provider_info
        
        return {
            'manager': {
                'request_count': self.request_count,
                'failover_count': self.failover_count,
                'total_characters_synthesized': self.total_characters_synthesized,
                'average_response_time': avg_response_time,
                'auto_failover': self.auto_failover,
                'load_balancing': self.load_balancing,
                'health_monitoring': self.health_monitoring,
                'prefer_cloud_for_quality': self.prefer_cloud_for_quality
            },
            'providers': provider_stats,
            'available_providers': self.get_available_providers(),
            'memory_usage': MemoryOptimizer.get_memory_usage()
        }
    
    async def close(self):
        """Close all providers and cleanup"""
        await self.stop_health_monitoring()
        
        for name, provider in self.providers.items():
            if hasattr(provider, 'close'):
                try:
                    await provider.close()
                except Exception as e:
                    logger.warning(f"⚠️ Error closing TTS provider '{name}': {e}")
        
        logger.info("🎵 Enhanced TTS Manager closed")


# Export main components
__all__ = ['EnhancedTTSManager', 'TTSProviderType', 'TTSProviderStatus', 'TTSProviderConfig']