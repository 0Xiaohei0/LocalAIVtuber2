"""
Cloud LLM Manager for unified local and cloud AI provider management
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

from .providers.GLMProvider import GLMProvider, create_glm_provider


class ProviderType(Enum):
    LOCAL = "local"
    CLOUD = "cloud"


class ProviderStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    DISABLED = "disabled"


@dataclass
class ProviderConfig:
    """Configuration for a provider"""
    name: str
    type: ProviderType
    enabled: bool = True
    priority: int = 1  # Lower number = higher priority
    max_tokens: int = 4096
    timeout: int = 60
    health_check_interval: int = 300  # 5 minutes
    failure_threshold: int = 3
    recovery_threshold: int = 2


@dataclass
class ProviderHealth:
    """Provider health status"""
    status: ProviderStatus
    last_check: float
    response_time_ms: float
    failure_count: int
    success_count: int
    last_error: Optional[str] = None


class CloudLLMManager:
    """Unified manager for local and cloud LLM providers"""
    
    def __init__(self, local_llm_instance=None):
        self.local_llm = local_llm_instance
        self.providers: Dict[str, Any] = {}
        self.provider_configs: Dict[str, ProviderConfig] = {}
        self.provider_health: Dict[str, ProviderHealth] = {}
        
        # Configuration
        self.auto_failover = True
        self.load_balancing = True
        self.health_monitoring = True
        
        # Statistics
        self.request_count = 0
        self.failover_count = 0
        self.total_response_time = 0.0
        
        # Background tasks
        self._health_check_task: Optional[asyncio.Task] = None
        
        # Initialize local provider if available
        if self.local_llm:
            self._register_local_provider()
        
        logger.info("🌐 Cloud LLM Manager initialized")
    
    def _register_local_provider(self):
        """Register the local LLM provider"""
        config = ProviderConfig(
            name="local",
            type=ProviderType.LOCAL,
            priority=2,  # Lower priority than cloud by default
            enabled=True
        )
        
        health = ProviderHealth(
            status=ProviderStatus.HEALTHY,
            last_check=time.time(),
            response_time_ms=0.0,
            failure_count=0,
            success_count=0
        )
        
        self.provider_configs["local"] = config
        self.provider_health["local"] = health
        self.providers["local"] = self.local_llm
        
        logger.info("🏠 Local LLM provider registered")
    
    async def register_cloud_provider(self, 
                                    name: str, 
                                    provider_type: str,
                                    config: Dict[str, Any]) -> bool:
        """Register a cloud provider"""
        try:
            if provider_type.lower() == "glm":
                provider = create_glm_provider(**config)
                
                # Test provider health
                health_result = await provider.health_check()
                if health_result['status'] != 'healthy':
                    logger.error(f"❌ Cloud provider '{name}' failed health check: {health_result}")
                    return False
                
                # Create provider configuration
                provider_config = ProviderConfig(
                    name=name,
                    type=ProviderType.CLOUD,
                    priority=1,  # Cloud providers get higher priority
                    enabled=True,
                    max_tokens=config.get('max_tokens', 4096),
                    timeout=config.get('timeout', 60)
                )
                
                provider_health = ProviderHealth(
                    status=ProviderStatus.HEALTHY,
                    last_check=time.time(),
                    response_time_ms=health_result.get('response_time_ms', 0),
                    failure_count=0,
                    success_count=1
                )
                
                self.providers[name] = provider
                self.provider_configs[name] = provider_config
                self.provider_health[name] = provider_health
                
                logger.info(f"☁️ Cloud provider '{name}' registered successfully")
                return True
            
            else:
                logger.error(f"❌ Unsupported provider type: {provider_type}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to register cloud provider '{name}': {e}")
            return False
    
    def get_available_providers(self) -> List[str]:
        """Get list of available and healthy providers"""
        available = []
        for name, config in self.provider_configs.items():
            if (config.enabled and 
                self.provider_health[name].status in [ProviderStatus.HEALTHY, ProviderStatus.DEGRADED]):
                available.append(name)
        
        # Sort by priority (lower numbers first)
        available.sort(key=lambda x: self.provider_configs[x].priority)
        return available
    
    def select_best_provider(self, 
                           preferred_type: Optional[ProviderType] = None,
                           exclude: List[str] = None) -> Optional[str]:
        """Select the best available provider"""
        exclude = exclude or []
        available = [p for p in self.get_available_providers() if p not in exclude]
        
        if not available:
            return None
        
        # Filter by preferred type if specified
        if preferred_type:
            typed_providers = [
                p for p in available 
                if self.provider_configs[p].type == preferred_type
            ]
            if typed_providers:
                available = typed_providers
        
        # Select based on health and response time
        best_provider = None
        best_score = float('inf')
        
        for provider_name in available:
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
    
    async def _update_provider_health(self, provider_name: str, success: bool, response_time_ms: float = 0, error: str = None):
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
                health.status = ProviderStatus.HEALTHY
            elif health.failure_count < self.provider_configs[provider_name].failure_threshold:
                health.status = ProviderStatus.DEGRADED
                
        else:
            health.failure_count += 1
            health.last_error = error
            
            config = self.provider_configs[provider_name]
            if health.failure_count >= config.failure_threshold:
                health.status = ProviderStatus.UNHEALTHY
                logger.warning(f"⚠️ Provider '{provider_name}' marked as unhealthy")
            else:
                health.status = ProviderStatus.DEGRADED
    
    @async_cached(ttl=60.0)  # Cache for 1 minute
    async def generate_completion(self, 
                                messages: List[Dict[str, str]],
                                preferred_provider: str = None,
                                **kwargs) -> Dict[str, Any]:
        """Generate completion with provider selection and failover"""
        start_time = time.time()
        self.request_count += 1
        
        # Select provider
        if preferred_provider and preferred_provider in self.providers:
            selected_provider = preferred_provider
        else:
            selected_provider = self.select_best_provider()
        
        if not selected_provider:
            raise RuntimeError("No available providers for completion")
        
        tried_providers = []
        last_error = None
        
        while selected_provider and selected_provider not in tried_providers:
            tried_providers.append(selected_provider)
            provider = self.providers[selected_provider]
            config = self.provider_configs[selected_provider]
            
            try:
                logger.debug(f"🤖 Trying provider '{selected_provider}' for completion")
                
                if config.type == ProviderType.CLOUD:
                    # Cloud provider (GLM)
                    result = await provider.generate_completion(messages, **kwargs)
                    completion_content = result['content']
                    provider_stats = result
                else:
                    # Local provider
                    if hasattr(provider, 'get_completion_async'):
                        # Use async method if available
                        completion_content = await provider.get_completion_async(
                            messages[-1]['content'] if messages else "",
                            messages[:-1] if len(messages) > 1 else [],
                            kwargs.get('system_prompt', ''),
                            **kwargs
                        )
                    else:
                        # Fall back to sync method in thread
                        from utils.performance_optimizer import run_in_thread
                        completion_content = await run_in_thread(
                            provider.get_completion,
                            messages[-1]['content'] if messages else "",
                            messages[:-1] if len(messages) > 1 else [],
                            kwargs.get('system_prompt', ''),
                            **kwargs
                        )
                    
                    provider_stats = {
                        'content': completion_content,
                        'model': 'local',
                        'usage': {'total_tokens': len(completion_content.split())},
                        'completion_time': time.time() - start_time
                    }
                
                # Update health statistics
                response_time = time.time() - start_time
                await self._update_provider_health(
                    selected_provider, 
                    success=True, 
                    response_time_ms=response_time * 1000
                )
                
                self.total_response_time += response_time
                
                logger.info(f"✅ Completion generated by '{selected_provider}' in {response_time:.2f}s")
                
                return {
                    **provider_stats,
                    'provider': selected_provider,
                    'provider_type': config.type.value,
                    'response_time': response_time,
                    'tried_providers': tried_providers
                }
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"⚠️ Provider '{selected_provider}' failed: {e}")
                
                # Update health statistics
                await self._update_provider_health(
                    selected_provider, 
                    success=False, 
                    error=last_error
                )
                
                # Select next provider for failover
                if self.auto_failover:
                    selected_provider = self.select_best_provider(exclude=tried_providers)
                    if selected_provider:
                        self.failover_count += 1
                        logger.info(f"🔄 Failing over to provider '{selected_provider}'")
                else:
                    break
        
        # All providers failed
        error_msg = f"All providers failed. Last error: {last_error}"
        logger.error(f"❌ {error_msg}")
        raise RuntimeError(error_msg)
    
    async def generate_completion_stream(self, 
                                       messages: List[Dict[str, str]],
                                       preferred_provider: str = None,
                                       **kwargs) -> AsyncIterator[Dict[str, Any]]:
        """Generate streaming completion with provider selection"""
        # Select cloud provider for streaming (local providers may not support streaming)
        if preferred_provider and preferred_provider in self.providers:
            selected_provider = preferred_provider
        else:
            selected_provider = self.select_best_provider(preferred_type=ProviderType.CLOUD)
        
        if not selected_provider:
            raise RuntimeError("No streaming-capable providers available")
        
        provider = self.providers[selected_provider]
        config = self.provider_configs[selected_provider]
        
        try:
            logger.debug(f"🌊 Starting streaming completion with '{selected_provider}'")
            
            if config.type == ProviderType.CLOUD:
                async for chunk in provider.generate_completion_stream(messages, **kwargs):
                    yield {
                        **chunk,
                        'provider': selected_provider,
                        'provider_type': config.type.value
                    }
            else:
                # Local providers typically don't support streaming
                # Fall back to regular completion
                result = await self.generate_completion(messages, selected_provider, **kwargs)
                yield {
                    'content': result['content'],
                    'delta': False,
                    'finish_reason': 'stop',
                    'provider': selected_provider,
                    'provider_type': config.type.value
                }
                
        except Exception as e:
            logger.error(f"❌ Streaming completion failed: {e}")
            await self._update_provider_health(selected_provider, success=False, error=str(e))
            raise
    
    async def start_health_monitoring(self):
        """Start background health monitoring"""
        if self._health_check_task:
            self._health_check_task.cancel()
        
        self._health_check_task = asyncio.create_task(self._health_monitor_loop())
        logger.info("🏥 Health monitoring started")
    
    async def stop_health_monitoring(self):
        """Stop background health monitoring"""
        if self._health_check_task:
            self._health_check_task.cancel()
            self._health_check_task = None
        logger.info("🏥 Health monitoring stopped")
    
    async def _health_monitor_loop(self):
        """Background health monitoring loop"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._perform_health_checks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Error in health monitoring: {e}")
    
    async def _perform_health_checks(self):
        """Perform health checks on all providers"""
        for name, provider in self.providers.items():
            config = self.provider_configs[name]
            health = self.provider_health[name]
            
            # Skip if recently checked
            if time.time() - health.last_check < config.health_check_interval:
                continue
            
            try:
                if config.type == ProviderType.CLOUD:
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
        """Get comprehensive statistics"""
        avg_response_time = (self.total_response_time / self.request_count 
                           if self.request_count > 0 else 0)
        
        provider_stats = {}
        for name, health in self.provider_health.items():
            config = self.provider_configs[name]
            provider_stats[name] = {
                'type': config.type.value,
                'status': health.status.value,
                'priority': config.priority,
                'enabled': config.enabled,
                'response_time_ms': health.response_time_ms,
                'failure_count': health.failure_count,
                'success_count': health.success_count,
                'last_check': health.last_check,
                'last_error': health.last_error
            }
        
        return {
            'manager': {
                'request_count': self.request_count,
                'failover_count': self.failover_count,
                'average_response_time': avg_response_time,
                'auto_failover': self.auto_failover,
                'load_balancing': self.load_balancing,
                'health_monitoring': self.health_monitoring
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
                    logger.warning(f"⚠️ Error closing provider '{name}': {e}")
        
        logger.info("🌐 Cloud LLM Manager closed")


# Export main components
__all__ = ['CloudLLMManager', 'ProviderType', 'ProviderStatus', 'ProviderConfig']