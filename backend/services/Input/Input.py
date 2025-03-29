import asyncio
import os
import wave
import sounddevice as sd
import numpy as np
import torch
from faster_whisper import WhisperModel
import onnxruntime
from silero_vad import load_silero_vad, VADIterator

class VoiceInput():
    current_module_directory = os.path.dirname(__file__)
    MIC_OUTPUT_PATH = os.path.join(
        current_module_directory, "voice_recording.wav")

    SAMPLING_RATE = 16000
    input_language = "en"
    whisper_filter_list = [
                'you', 'thank you.', 'thanks for watching.', "Thank you for watching.", "1.5%", "I'm going to put it in the fridge.", "I", ".", "okay.", "bye.", "so,", "I'm sorry."]
    SPEECH_THRESHOLD = 0.3
    SILENCE_WAIT_TIME = 0.1 * SAMPLING_RATE 
    PRE_SPEECH_SAMPLES = 0.5 * SAMPLING_RATE  
    POST_SPEECH_SAMPLES = 0.5 * SAMPLING_RATE  


    current_module_directory = os.path.dirname(__file__)

    vad_model = load_silero_vad()
    device = "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    whisper_model = WhisperModel("small", device=device) # Load Whisper model    
    
    vad_iterator = VADIterator(vad_model, sampling_rate=SAMPLING_RATE)
    sentence_audio_buffer = []
    tmp_audio_buffer = []
    silent_samples = 0
    started_speaking = False

    def process_audio(self, audio_np):

        self.tmp_audio_buffer.extend(audio_np)

        while len(self.tmp_audio_buffer) >= 512:
            chunk = np.array(self.tmp_audio_buffer[:512])  # Extract first 512 samples
            self.tmp_audio_buffer = self.tmp_audio_buffer[512:]  # Remove processed chunk

            # Run VAD on the chunk
            speech_prob = self.vad_model(torch.from_numpy(chunk), self.SAMPLING_RATE).item()
            # print(f"speech_prob: {speech_prob}")
            if speech_prob < self.SPEECH_THRESHOLD:
                if self.silent_samples <= self.SILENCE_WAIT_TIME:
                    self.silent_samples += 512
            else:
                self.silent_samples = 0
                if not self.started_speaking:
                    # Capture pre-speech samples
                    pre_speech_samples = self.sentence_audio_buffer[-int(self.PRE_SPEECH_SAMPLES):]
                    self.sentence_audio_buffer = list(pre_speech_samples)
                self.started_speaking = True
            # print(f"silent_samples: {self.silent_samples}")
            if self.started_speaking:
                self.sentence_audio_buffer.extend(chunk)

            if self.started_speaking and self.silent_samples > self.SILENCE_WAIT_TIME:  # 2 seconds of silence
                print("User finished speaking! Sending to STT...")
                # Capture post-speech samples
                post_speech_samples = self.tmp_audio_buffer[:int(self.POST_SPEECH_SAMPLES)]
                self.sentence_audio_buffer.extend(post_speech_samples)
                transcribed_text = self.process_speech(np.array(self.sentence_audio_buffer))  # Process audio
                print(f"transcribed_text {transcribed_text}")
                self.vad_iterator.reset_states()  # Reset VAD for next detection
                self.tmp_audio_buffer = []  # Clear buffer
                self.sentence_audio_buffer = [] 
                self.silent_samples = 0
                self.started_speaking = False

    def process_speech(self, audio_data):
        with wave.open(self.MIC_OUTPUT_PATH, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes((audio_data * 32768.0).astype(np.int16).tobytes())

        transcribed_text = ''
        segments, _  = self.whisper_model.transcribe(self.MIC_OUTPUT_PATH, language=self.input_language)  # Updated transcription
        segments = list(segments)
        for segment in segments:
            transcribed_text += segment.text
        if (transcribed_text == ''):
            return

        if (transcribed_text.strip().lower() in self.whisper_filter_list):
            return
        return transcribed_text
    
    def start(self):
        print("Recording audio... Press Ctrl+C to stop.")
        try:
            with sd.InputStream(samplerate=self.SAMPLING_RATE, channels=1, dtype='int16') as stream:
                while True:
                    audio_bytes = stream.read(1024)[0].tobytes()  # Read audio in chunks
                    audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0  # Convert PCM to float
                    self.process_audio(audio_np)
        except KeyboardInterrupt:
            print("Recording stopped.")

if __name__ == "__main__":
    vi = VoiceInput()
    vi.start()
