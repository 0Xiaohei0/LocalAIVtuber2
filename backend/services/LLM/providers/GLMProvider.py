"""
GLM 4.5 API Provider for Cloud AI Integration
Supports streaming responses, rate limiting, and advanced conversation handling.
"""

import asyncio
import json
import time
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
class GLMConfig:
    """Configuration for GLM 4.5 API"""
    api_key: str
    base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    model: str = "glm-4-plus"
    max_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 0.9
    stream: bool = True
    timeout: int = 60
    max_retries: int = 3
    rate_limit_rpm: int = 100  # Requests per minute


class RateLimiter:
    """Token bucket rate limiter for API requests"""
    
    def __init__(self, max_requests: int, time_window: int = 60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = []
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        """Acquire permission to make a request"""
        async with self._lock:
            now = datetime.now()
            # Remove old requests outside the time window
            self.requests = [
                req_time for req_time in self.requests
                if now - req_time < timedelta(seconds=self.time_window)
            ]
            
            if len(self.requests) < self.max_requests:
                self.requests.append(now)
                return True
            return False
    
    async def wait_if_needed(self):
        """Wait until we can make a request"""
        while not await self.acquire():
            await asyncio.sleep(1)


class GLMProvider:
    """GLM 4.5 API Provider with advanced features"""
    
    def __init__(self, config: GLMConfig):
        self.config = config
        self.rate_limiter = RateLimiter(config.rate_limit_rpm)
        self._session: Optional[aiohttp.ClientSession] = None
        self.request_count = 0
        self.total_tokens_used = 0
        self.last_request_time = None
        
        # Validate API key
        if not config.api_key:
            raise ValueError("GLM API key is required")
    
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
    
    def _prepare_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Prepare messages for GLM API format"""
        formatted_messages = []
        
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            
            # Ensure valid role
            if role not in ['system', 'user', 'assistant']:
                role = 'user'
            
            formatted_messages.append({
                'role': role,
                'content': content
            })
        
        return formatted_messages
    
    def _prepare_request_data(self, 
                            messages: List[Dict[str, str]], 
                            **kwargs) -> Dict[str, Any]:
        """Prepare request data for GLM API"""
        # Merge config with request-specific parameters
        request_config = {
            'model': kwargs.get('model', self.config.model),
            'messages': self._prepare_messages(messages),
            'max_tokens': kwargs.get('max_tokens', self.config.max_tokens),
            'temperature': kwargs.get('temperature', self.config.temperature),
            'top_p': kwargs.get('top_p', self.config.top_p),
            'stream': kwargs.get('stream', self.config.stream)
        }
        
        # Add optional parameters if provided
        optional_params = ['stop', 'presence_penalty', 'frequency_penalty']
        for param in optional_params:
            if param in kwargs:
                request_config[param] = kwargs[param]
        
        return request_config
    
    async def _make_request(self, data: Dict[str, Any]) -> aiohttp.ClientResponse:
        """Make HTTP request to GLM API with error handling"""
        # Apply rate limiting
        await self.rate_limiter.wait_if_needed()
        
        session = await self._get_session()
        headers = {
            'Authorization': f'Bearer {self.config.api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'NEX-ARIS-AI-VTuber/1.0'
        }
        
        url = f"{self.config.base_url}/chat/completions"
        
        async def _request():
            async with session.post(url, json=data, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise aiohttp.ClientError(
                        f"GLM API error {response.status}: {error_text}"
                    )
                return response
        
        # Use retry logic for robust requests
        response = await RetryManager.retry_async(
            _request,
            max_retries=self.config.max_retries,
            exceptions=(aiohttp.ClientError, asyncio.TimeoutError)
        )
        
        # Update statistics
        self.request_count += 1
        self.last_request_time = time.time()
        
        return response
    
    @async_cached(ttl=300.0)  # Cache for 5 minutes
    async def generate_completion(self, 
                                messages: List[Dict[str, str]], 
                                **kwargs) -> Dict[str, Any]:
        """Generate a single completion response"""
        logger.debug(f"🤖 Generating GLM completion for {len(messages)} messages")
        start_time = time.time()
        
        try:
            # Prepare request without streaming
            data = self._prepare_request_data(messages, stream=False, **kwargs)
            
            response = await self._make_request(data)
            result = await response.json()
            
            # Extract completion and token usage
            completion = result['choices'][0]['message']['content']
            usage = result.get('usage', {})
            
            # Update token statistics
            self.total_tokens_used += usage.get('total_tokens', 0)
            
            completion_time = time.time() - start_time
            logger.info(f"🤖 GLM completion generated in {completion_time:.2f}s, "
                       f"tokens: {usage.get('total_tokens', 0)}")
            
            return {
                'content': completion,
                'usage': usage,
                'model': result.get('model', self.config.model),
                'completion_time': completion_time
            }
            
        except Exception as e:
            logger.error(f"❌ GLM completion failed: {e}")
            raise
    
    async def generate_completion_stream(self, 
                                       messages: List[Dict[str, str]], 
                                       **kwargs) -> AsyncIterator[Dict[str, Any]]:
        """Generate streaming completion response"""
        logger.debug(f"🌊 Starting GLM streaming completion for {len(messages)} messages")
        start_time = time.time()
        
        try:
            # Prepare request with streaming
            data = self._prepare_request_data(messages, stream=True, **kwargs)
            
            response = await self._make_request(data)
            
            # Process streaming response
            async for line in response.content:
                line = line.decode('utf-8').strip()
                
                if not line or not line.startswith('data: '):
                    continue
                
                # Parse SSE data
                data_content = line[6:]  # Remove 'data: ' prefix
                
                if data_content == '[DONE]':
                    break
                
                try:
                    chunk = json.loads(data_content)
                    delta = chunk['choices'][0]['delta']
                    
                    if 'content' in delta:
                        yield {
                            'content': delta['content'],
                            'delta': True,
                            'finish_reason': chunk['choices'][0].get('finish_reason'),
                            'model': chunk.get('model', self.config.model)
                        }
                
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f"⚠️ Failed to parse streaming chunk: {e}")
                    continue
            
            completion_time = time.time() - start_time
            logger.info(f"🌊 GLM streaming completed in {completion_time:.2f}s")
            
        except Exception as e:
            logger.error(f"❌ GLM streaming failed: {e}")
            raise
    
    async def generate_chat_completion(self, 
                                     user_message: str,
                                     history: List[Dict[str, str]] = None,
                                     system_prompt: str = None,
                                     **kwargs) -> str:
        """Generate chat completion with conversation history"""
        messages = []
        
        # Add system prompt if provided
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        
        # Add conversation history
        if history:
            messages.extend(history)
        
        # Add current user message
        messages.append({'role': 'user', 'content': user_message})
        
        # Generate completion
        result = await self.generate_completion(messages, **kwargs)
        return result['content']
    
    async def generate_chat_completion_stream(self, 
                                            user_message: str,
                                            history: List[Dict[str, str]] = None,
                                            system_prompt: str = None,
                                            **kwargs) -> AsyncIterator[str]:
        """Generate streaming chat completion"""
        messages = []
        
        # Add system prompt if provided
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        
        # Add conversation history
        if history:
            messages.extend(history)
        
        # Add current user message
        messages.append({'role': 'user', 'content': user_message})
        
        # Generate streaming completion
        async for chunk in self.generate_completion_stream(messages, **kwargs):
            if chunk.get('delta') and 'content' in chunk:
                yield chunk['content']
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get provider statistics"""
        return {
            'provider': 'GLM-4.5',
            'model': self.config.model,
            'request_count': self.request_count,
            'total_tokens_used': self.total_tokens_used,
            'last_request_time': self.last_request_time,
            'rate_limit_rpm': self.config.rate_limit_rpm,
            'current_requests_in_window': len(self.rate_limiter.requests),
            'memory_usage': MemoryOptimizer.get_memory_usage()
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check API health and connectivity"""
        try:
            test_messages = [{'role': 'user', 'content': 'Hello, test connection'}]
            start_time = time.time()
            
            result = await self.generate_completion(
                test_messages, 
                max_tokens=10,
                temperature=0.1
            )
            
            response_time = time.time() - start_time
            
            return {
                'status': 'healthy',
                'response_time_ms': response_time * 1000,
                'model': result.get('model'),
                'tokens_used': result.get('usage', {}).get('total_tokens', 0)
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'response_time_ms': None
            }


# Factory function for easy provider creation
def create_glm_provider(api_key: str = None, **config_kwargs) -> GLMProvider:
    """Create GLM provider with configuration"""
    # Get API key from environment if not provided
    if api_key is None:
        api_key = os.getenv('GLM_API_KEY')
    
    if not api_key:
        raise ValueError("GLM API key must be provided or set in GLM_API_KEY environment variable")
    
    config = GLMConfig(api_key=api_key, **config_kwargs)
    return GLMProvider(config)


# Export main components
__all__ = ['GLMProvider', 'GLMConfig', 'create_glm_provider']