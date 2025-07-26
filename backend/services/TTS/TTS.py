from services.lib.LAV_logger import logger
from typing import Optional, Dict, Any
from .GPTsovits.GptSovits import GptSovits
from .RVC.RVC import RVCInference
from .BaseTTS import BaseTTS

class TTS:
    def __init__(self):
        self.engines: Dict[str, BaseTTS] = {
            'gptsovits': GptSovits(),
            'rvc': RVCInference()
        }
        self.current_engine = 'rvc'  # Default engine

    def get_available_engines(self) -> list:
        """Get list of available TTS engines"""
        return list(self.engines.keys())

    def get_current_engine(self) -> str:
        """Get the name of the current TTS engine"""
        return self.current_engine

    def set_engine(self, engine_name: str) -> dict:
        """Set the current TTS engine"""
        if engine_name not in self.engines:
            raise ValueError(f"Unknown engine: {engine_name}")
        self.current_engine = engine_name
        return {"message": f"Switched to {engine_name} engine"}

    def get_available_voices(self) -> list:
        """Get list of available voices for current engine"""
        return self.engines[self.current_engine].get_available_voices()

    def change_voice(self, voice_name: str) -> dict:
        """Change the voice for current engine"""
        return self.engines[self.current_engine].change_voice(voice_name)

    def synthesize(self, text: str) -> Optional[bytes]:
        """Synthesize text using current engine"""
        return self.engines[self.current_engine].synthesize(text)

    def configure_engine(self, engine_name: str, **kwargs) -> None:
        """Configure specific engine parameters"""
        if engine_name not in self.engines:
            raise ValueError(f"Unknown engine: {engine_name}")
        
        engine = self.engines[engine_name]
        if hasattr(engine, 'configure'):
            engine.configure(**kwargs)
        else:
            logger.warning(f"Engine {engine_name} does not support configuration")
