from io import BytesIO
import os
import subprocess
import sys
from typing import Generator
import wave
import numpy as np
import soundfile as sf


base_dir = os.path.dirname(__file__)

# Add GPT_SoVITS root directly to sys.path
gptsovits_root = os.path.join(base_dir, "GPTsovits", "GPT_SoVITS")
sys.path.insert(0, gptsovits_root)  # Must come before importing
gpt_sovits_root = os.path.join(base_dir, "GPTsovits")
sys.path.insert(0, gpt_sovits_root)  # Must come before importing

from .GPTsovits.GPT_SoVITS.TTS_infer_pack.TTS import TTS as TTS_gptsovits, TTS_Config
from .GPTsovits.GPT_SoVITS.TTS_infer_pack.text_segmentation_method import get_method_names as get_cut_method_names




current_module_directory = os.path.dirname(__file__)
cut_method_names = get_cut_method_names()
ref_audio_path = os.path.join(current_module_directory,"models","leaf","The birch canoe slid on the smooth planks.golden sheep to the dark blue background.wav")
prompt_text = "The birch canoe slid on the smooth planks.golden sheep to the dark blue background."

class TTS:
    def __init__(self):
        config_path = os.path.join(gpt_sovits_root,"GPT_SoVITS","configs","tts_infer.yaml")
        self.tts_config = TTS_Config(config_path)
        self.tts_pipeline = TTS_gptsovits(self.tts_config)

    def syntheize(self, text):
        req = {
            "text": text,
            "text_lang": 'en',
            "ref_audio_path": ref_audio_path,
            "aux_ref_audio_paths": [],
            "prompt_text": prompt_text,
            "prompt_lang": 'en',
            "top_k": 5,
            "top_p": 1,
            "temperature": 1,
            "text_split_method": "cut5",
            "batch_size":int(1),
            "batch_threshold":float(0.75),
            "speed_factor":float(1.0),
            "split_bucket":True,
            "fragment_interval":0.3,
            "seed":-1,
            "media_type":"wav",
            "streaming_mode": True,
            "parallel_infer": True,
            "repetition_penalty":float(1.35),
            "sample_steps":int(32),
            "super_sampling":False
        }
        
        streaming_mode = req.get("streaming_mode", False)
        return_fragment = req.get("return_fragment", False)
        media_type = req.get("media_type", "wav")

        check_res = self.check_params(req)
        if check_res is not None:
            return check_res

        if streaming_mode or return_fragment:
            req["return_fragment"] = True
            
        try:
            tts_generator=self.tts_pipeline.run(req)
            
            if streaming_mode:
                def streaming_generator(tts_generator:Generator, media_type:str):
                    if_frist_chunk = True
                    for sr, chunk in tts_generator:
                        if if_frist_chunk and media_type == "wav":
                            yield wave_header_chunk(sample_rate=sr)
                            media_type = "raw"
                            if_frist_chunk = False
                        yield pack_audio(BytesIO(), chunk, sr, media_type).getvalue()
                return streaming_generator(tts_generator, media_type, )
        
            else:
                sr, audio_data = next(tts_generator)
                audio_data = pack_audio(BytesIO(), audio_data, sr, media_type).getvalue()
                return audio_data
        except Exception as e:
            return {"message": f"tts failed", "Exception": str(e)}
        
    

    def check_params(self, req:dict):
        text:str = req.get("text", "")
        text_lang:str = req.get("text_lang", "")
        ref_audio_path:str = req.get("ref_audio_path", "")
        streaming_mode:bool = req.get("streaming_mode", False)
        media_type:str = req.get("media_type", "wav")
        prompt_lang:str = req.get("prompt_lang", "")
        text_split_method:str = req.get("text_split_method", "cut5")

        if ref_audio_path in [None, ""]:
            return {"message": "ref_audio_path is required"}
        if text in [None, ""]:
            return {"message": "text is required"}
        if (text_lang in [None, ""]) :
            return {"message": "text_lang is required"}
        elif text_lang.lower() not in self.tts_config.languages:
            return {"message": f"text_lang: {text_lang} is not supported in version {self.tts_config.version}"}
        if (prompt_lang in [None, ""]) :
            return {"message": "prompt_lang is required"}
        elif prompt_lang.lower() not in self.tts_config.languages:
            return {"message": f"prompt_lang: {prompt_lang} is not supported in version {self.tts_config.version}"}
        if media_type not in ["wav", "raw", "ogg", "aac"]:
            return {"message": f"media_type: {media_type} is not supported"}
        elif media_type == "ogg" and  not streaming_mode:
            return {"message": "ogg format is not supported in non-streaming mode"}
        
        if text_split_method not in cut_method_names:
            return {"message": f"text_split_method:{text_split_method} is not supported"}

        return None

def pack_ogg(io_buffer:BytesIO, data:np.ndarray, rate:int):
    with sf.SoundFile(io_buffer, mode='w', samplerate=rate, channels=1, format='ogg') as audio_file:
        audio_file.write(data)
    return io_buffer


def pack_raw(io_buffer:BytesIO, data:np.ndarray, rate:int):
    io_buffer.write(data.tobytes())
    return io_buffer


def pack_wav(io_buffer:BytesIO, data:np.ndarray, rate:int):
    io_buffer = BytesIO()
    sf.write(io_buffer, data, rate, format='wav')
    return io_buffer

def pack_aac(io_buffer:BytesIO, data:np.ndarray, rate:int):
    process = subprocess.Popen([
        'ffmpeg',
        '-f', 's16le',  # 输入16位有符号小端整数PCM
        '-ar', str(rate),  # 设置采样率
        '-ac', '1',  # 单声道
        '-i', 'pipe:0',  # 从管道读取输入
        '-c:a', 'aac',  # 音频编码器为AAC
        '-b:a', '192k',  # 比特率
        '-vn',  # 不包含视频
        '-f', 'adts',  # 输出AAC数据流格式
        'pipe:1'  # 将输出写入管道
    ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, _ = process.communicate(input=data.tobytes())
    io_buffer.write(out)
    return io_buffer

def pack_audio(io_buffer:BytesIO, data:np.ndarray, rate:int, media_type:str):
    if media_type == "ogg":
        io_buffer = pack_ogg(io_buffer, data, rate)
    elif media_type == "aac":
        io_buffer = pack_aac(io_buffer, data, rate)
    elif media_type == "wav":
        io_buffer = pack_wav(io_buffer, data, rate)
    else:
        io_buffer = pack_raw(io_buffer, data, rate)
    io_buffer.seek(0)
    return io_buffer

def wave_header_chunk(frame_input=b"", channels=1, sample_width=2, sample_rate=32000):
    # This will create a wave header then append the frame input
    # It should be first on a streaming wav file
    # Other frames better should not have it (else you will hear some artifacts each chunk start)
    wav_buf = BytesIO()
    with wave.open(wav_buf, "wb") as vfout:
        vfout.setnchannels(channels)
        vfout.setsampwidth(sample_width)
        vfout.setframerate(sample_rate)
        vfout.writeframes(frame_input)

    wav_buf.seek(0)
    return wav_buf.read()
