from services.lib.LAV_logger import logger

from .GPTsovits.GptSovits import GptSovits

class TTS:
    def __init__(self):
        self.tts_engine = GptSovits()

    def get_available_voices(self):
        """Get list of available voices from the models directory"""
        return self.tts_engine.get_available_voices()

    def change_voice(self, voice_name):
        """Change the current voice to the specified one"""
        return self.tts_engine.change_voice(voice_name)

    def synthesize(self, text):
        """Synthesize text to speech using the current voice"""
        return self.tts_engine.synthesize(text)
