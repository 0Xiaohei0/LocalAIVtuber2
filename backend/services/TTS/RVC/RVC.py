import io
import re
import os
import asyncio
from typing import Optional
import numpy as np
import soundfile as sf
from pydub import AudioSegment
import edge_tts
from ..BaseTTS import BaseTTS
from .inferrvc import load_torchaudio, RVC
from .edge_tts_voices import SUPPORTED_VOICES

class RVCInference(BaseTTS):
    def __init__(self):
        self.current_module_directory = os.path.dirname(__file__)
        self.EDGE_TTS_OUTPUT_FILENAME = os.path.join(
            self.current_module_directory, "edgetts_output.mp3")
        self.RVC_OUTPUT_FILENAME = os.path.join(
            self.current_module_directory, "rvc_output.wav")
        self.rvc_model_dir = os.path.join(self.current_module_directory, "rvc_model_dir")
        self.rvc_index_dir = os.path.join(self.current_module_directory, "rvc_index_dir")

        # Default settings
        self.edge_tts_voice = "en-US-AnaNeural"
        self.rvc_model_name = 'qiqi.pth'
        self.use_rvc = True
        self.transpose = 0
        self.index_rate = 0.75
        self.protect = 0.5

        self._initialize_rvc()

    def _initialize_rvc(self):
        """Initialize RVC model and environment"""
        # Set environment variables
        os.environ['RVC_MODELDIR'] = self.rvc_model_dir
        os.environ['RVC_INDEXDIR'] = self.rvc_index_dir
        os.environ['RVC_OUTPUTFREQ'] = '44100'
        os.environ['RVC_RETURNBLOCKING'] = 'False'

        # Initialize model
        self.model = RVC(self.rvc_model_name)

    def get_available_voices(self) -> list:
        """Get list of available RVC models"""
        rvc_models = []
        if os.path.exists(self.rvc_model_dir):
            for name in os.listdir(self.rvc_model_dir):
                if name.endswith(".pth"):
                    rvc_models.append(name)
        return rvc_models

    def get_available_tts_voices(self) -> list:
        """Get list of available Edge TTS voices"""
        return SUPPORTED_VOICES

    def change_voice(self, voice_name: str) -> dict:
        """Change the current RVC model"""
        if not voice_name.endswith('.pth'):
            raise ValueError("Invalid RVC model name. Must end with .pth")
        
        model_path = os.path.join(self.rvc_model_dir, voice_name)
        if not os.path.exists(model_path):
            raise ValueError(f"RVC model not found: {voice_name}")
        
        self.rvc_model_name = voice_name
        self.model = RVC(self.rvc_model_name)
        return {"message": f"Voice changed to {voice_name}"}

    def change_tts_voice(self, voice_name: str):
        """Change the Edge TTS voice"""
        if voice_name not in SUPPORTED_VOICES:
            raise ValueError(f"Unsupported Edge TTS voice: {voice_name}")
        self.edge_tts_voice = voice_name

    def _preprocess_text(self, text: str) -> str:
        """Replace decimal points with the word 'point' for better TTS"""
        pattern = r'\b\d*\.\d+\b'
        def replace_match(match):
            decimal_number = match.group(0)
            return decimal_number.replace('.', ' point ')
        return re.sub(pattern, replace_match, text)

    async def _generate_tts_audio(self, text: str) -> Optional[np.ndarray]:
        """Generate audio using Edge TTS"""
        try:
            communicate = edge_tts.Communicate(text, self.edge_tts_voice)
            await communicate.save(self.EDGE_TTS_OUTPUT_FILENAME)
            
            # Convert MP3 to WAV
            audio = AudioSegment.from_mp3(self.EDGE_TTS_OUTPUT_FILENAME)
            wav_filename = self.EDGE_TTS_OUTPUT_FILENAME.replace('.mp3', '.wav')
            audio.export(wav_filename, format='wav')
            return wav_filename
        except Exception as e:
            print(f"Error in TTS generation: {e}")
            return None

    def synthesize(self, text: str) -> Optional[bytes]:
        """Synthesize text to speech using Edge TTS and optionally RVC"""
        text = self._preprocess_text(text)
        wav_filename = asyncio.run(self._generate_tts_audio(text))
        
        if not wav_filename:
            return None

        try:
            if self.use_rvc:
                # Apply RVC processing
                aud, sr = load_torchaudio(wav_filename)
                processed_audio = self.model(
                    aud, 
                    f0_up_key=self.transpose,
                    output_volume=RVC.MATCH_ORIGINAL, 
                    index_rate=self.index_rate, 
                    protect=self.protect
                )
                
                # Convert to numpy and save
                audio_np = processed_audio.cpu().numpy()
                sf.write(self.RVC_OUTPUT_FILENAME, audio_np, 44100)
                
                # Convert to bytes
                audio = AudioSegment.from_wav(self.RVC_OUTPUT_FILENAME)
                buffer = io.BytesIO()
                audio.export(buffer, format='wav')
                return buffer.getvalue()
            else:
                # Return direct TTS output
                audio = AudioSegment.from_wav(wav_filename)
                buffer = io.BytesIO()
                audio.export(buffer, format='wav')
                return buffer.getvalue()
                
        except Exception as e:
            print(f"Error in audio processing: {e}")
            return None
        finally:
            # Cleanup temporary files
            if os.path.exists(self.EDGE_TTS_OUTPUT_FILENAME):
                os.remove(self.EDGE_TTS_OUTPUT_FILENAME)
            if os.path.exists(wav_filename):
                os.remove(wav_filename)
            if os.path.exists(self.RVC_OUTPUT_FILENAME):
                os.remove(self.RVC_OUTPUT_FILENAME)

    def configure(self, **kwargs):
        """Configure RVC parameters"""
        if 'transpose' in kwargs:
            self.transpose = max(-24, min(24, kwargs['transpose']))
        if 'index_rate' in kwargs:
            self.index_rate = max(0, min(1, kwargs['index_rate']))
        if 'protect' in kwargs:
            self.protect = max(0, min(0.5, kwargs['protect']))
        if 'use_rvc' in kwargs:
            self.use_rvc = bool(kwargs['use_rvc'])