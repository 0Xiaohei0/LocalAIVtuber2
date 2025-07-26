import time
from services.lib.startup_progress import startup_progress
# Track import time
start_time = time.time()
total_start_time = time.time()
startup_progress.show_step("Importing python modules")

import asyncio
import traceback
from services.ChatFetch.Chatfetch import ChatFetch
from services.Input.Input import VoiceInput
from services.Input.VisionInput import VisionInput
from services.TTS.TTS import TTS
from services.Memory.Memory import Memory
from services.Memory.HistoryStore import HistoryStore
from services.Character.characterManager import CharacterManager
from services.lib.LAV_logger import logger
import os
import requests
import aiofiles
import aiohttp
from fastapi import FastAPI, Query, Request, Response, WebSocket, HTTPException, File, UploadFile, Form
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from services.LLM.LLM import LLM
from pydantic import BaseModel
from datetime import datetime
import json
from typing import Any, Dict, List
import mss
import traceback

# Download progress tracking
download_progress = {}

# Show import completion immediately after imports
import_time = time.time() - start_time
startup_progress.complete_step(f"Imports completed in {import_time:.2f}s")

app = FastAPI()
static_files_path = os.path.abspath("../frontend/dist")
app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")
app.mount("/resource", StaticFiles(directory="../frontend/dist/resource"), name="resource")

# Initialize Services
start_time = time.time()
startup_progress.show_step("Loading AI Services")
voice_input:VoiceInput = VoiceInput()
llm:LLM = LLM()
memory:Memory = Memory()
history_store:HistoryStore = HistoryStore()
tts:TTS = TTS()
vision_input:VisionInput = VisionInput()
character_manager:CharacterManager = CharacterManager()
startup_progress.complete_step(f"AI Services loaded in {time.time() - start_time:.2f}s")

clients = set()

# Initialize ChatFetch service
chat_fetch = ChatFetch()
chat_clients = set()

# *******************************
# WebUI
# *******************************

@app.get("/")
async def serve_webui():
    return FileResponse("../frontend/dist/index.html")

# *******************************
# Input
# *******************************

@app.post("/api/record/start")
async def start_recording():
    asyncio.create_task(voice_input.start_streaming(clients))
    return Response(status_code=200)

@app.post("/api/record/stop")
async def stop_recording():
    voice_input.stop_streaming()
    return Response(status_code=200)

@app.websocket("/ws/audio")
async def websocket_audio(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        clients.remove(websocket)
        try:
            await websocket.close()
        except RuntimeError:
            pass  # Already closed

@app.get("/api/monitors")
async def get_monitor_info():
    """
    Get information about available monitors.
    """
    try:
        monitors = vision_input.get_monitors()
        logger.info(f"Monitors Server: {monitors}")
            
        monitor_info = []
        for i, monitor in enumerate(monitors):
            # Determine if this is likely the primary monitor
            # Primary monitor usually has left=0 and top=0 or is the first actual monitor
            is_primary = (monitor["left"] == 0 and monitor["top"] == 0)
            
            monitor_info.append({
                "index": i,
                "width": monitor["width"],
                "height": monitor["height"],
                "top": monitor["top"],
                "left": monitor["left"],
                "is_primary": is_primary,
                "description": f"Monitor {i} ({monitor['width']}x{monitor['height']}) at ({monitor['left']}, {monitor['top']})"
            })
        
        return JSONResponse(
            status_code=200,
            content={
                "monitors": monitor_info,
                "count": len(monitors)
            }
        )
    except Exception as e:
        logger.error(f"Error getting monitor info: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get monitor info: {str(e)}"}
        )

async def process_screenshot_async(monitor_index: int, ocr_scale_factor: float, skip_ocr: bool = False):
    """
    Async wrapper for screenshot processing to avoid blocking the event loop.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    
    # Run the synchronous screenshot processing in a thread pool
    result = await loop.run_in_executor(
        None,
        lambda: vision_input.process_screen(
            monitor_index=monitor_index,
            save_screenshot=False,
            confidence_threshold=0.5,
            ocr_scale_factor=ocr_scale_factor,
            skip_ocr=skip_ocr
        )
    )
    
    return result

@app.get("/api/screenshot")
async def get_screenshot(monitor_index: int = 1, ocr_scale_factor: float = 0.5, skip_ocr: bool = False):
    """
    Capture a screenshot and return the image, caption, and extracted text.
    
    Args:
        monitor_index: Index of the monitor to capture
        ocr_scale_factor: Factor to scale down image for OCR processing (0.1 to 1.0)
        skip_ocr: Whether to skip OCR processing and only generate caption
    """
    try:
        logger.info(f"Screenshot request for monitor index: {monitor_index}, scale factor: {ocr_scale_factor}, skip OCR: {skip_ocr}")
        
        # Validate scale factor
        if ocr_scale_factor < 0.1 or ocr_scale_factor > 1.0:
            return JSONResponse(
                status_code=400,
                content={"error": "OCR scale factor must be between 0.1 and 1.0"}
            )
        
        # Process screen asynchronously using asyncio.create_task
        task = asyncio.create_task(process_screenshot_async(monitor_index, ocr_scale_factor, skip_ocr))
        result = await task
        
        if not result['success']:
            return JSONResponse(
                status_code=500, 
                content={"error": "Failed to capture screenshot"}
            )
        
        # Convert screenshot to base64 for JSON response
        import io
        import base64
        img_byte_arr = io.BytesIO()
        result['screenshot'].save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        image_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        # Extract all detected text
        detected_text = vision_input.get_detected_text(result['ocr_results'])
        
        # Convert numpy types to native Python types for JSON serialization
        def convert_numpy_types(obj):
            if hasattr(obj, 'item'):  # numpy scalar
                return obj.item()
            elif isinstance(obj, (list, tuple)):
                return [convert_numpy_types(item) for item in obj]
            elif isinstance(obj, dict):
                return {key: convert_numpy_types(value) for key, value in obj.items()}
            return obj
        
        # Convert OCR results to ensure JSON serialization
        converted_ocr_results = convert_numpy_types(result['ocr_results'])
        
        # Return JSON response with all data
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "image": image_base64,
                "caption": result['caption'] or "",
                "extracted_text": detected_text,
                "ocr_count": len(result['ocr_results']),
                "ocr_results": converted_ocr_results,  # Converted OCR data
                "ocr_scale_factor": ocr_scale_factor
            }
        )
        
    except Exception as e:
        logger.error(f"Error capturing screenshot: {e}, {traceback.format_exc()}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Failed to capture screenshot: {str(e)}"}
        )

# *******************************
# StreamChat
# *******************************

@app.websocket("/ws/streamChat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    chat_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        chat_clients.remove(websocket)
        try:
            await websocket.close()
        except RuntimeError:
            pass 

@app.post("/api/streamChat/yt/start")
async def start_fetch_youtube():
    asyncio.create_task(chat_fetch.start_fetching(chat_clients))
    return JSONResponse(status_code=200, content={"message": "Chat fetch started"})

@app.post("/api/streamChat/yt/stop")
async def stop_fetch_youtube():
    chat_fetch.stop_fetching()
    return JSONResponse(status_code=200, content={"message": "Chat fetch stopped"})


# *******************************
# LLM
# *******************************

class LLMRequest(BaseModel):
    text: str
    history: list | None = None
    systemPrompt: str = ""
    screenshot: bool = False

class CompleteResponseRequest(BaseModel):
    history: list
    systemPrompt: str = ""

@app.post("/api/completion")
async def get_completion(request: LLMRequest, fastapi_request: Request):
    try:
        response = llm.get_completion(request.text, request.history, request.systemPrompt, request.screenshot)
        if response is None:
            return {"error": "No response from LLM service"}
        
        async def stream_response():
            try:
                # Wrap the generator in an asynchronous generator
                async for chunk in async_generator_wrapper(response):
                    # Check if the client has disconnected
                    if await fastapi_request.is_disconnected():
                        logger.info("Client disconnected, stopping response stream.")
                        break
                    yield chunk
            finally:
                pass
                # llm.unload_model()  # Ensure the model is unloaded when the stream ends or is interrupted

        return StreamingResponse(stream_response(), media_type="text/plain")
    except Exception as e:
        logger.error(f"Error during completion: {e}", exc_info=True)
        return {"error": "Internal server error"}

@app.post("/api/completion/complete")
async def complete_current_response(request: CompleteResponseRequest, fastapi_request: Request):
    try:
        if not llm.llm:
            llm.load_model(llm.current_model_data)
            
        response = llm.complete_current_response(request.history, request.systemPrompt)
        if response is None:
            return {"error": "No response from LLM service"}
        
        async def stream_response():
            try:
                async for chunk in async_generator_wrapper(response):
                    if await fastapi_request.is_disconnected():
                        logger.info("Client disconnected, stopping response stream.")
                        break
                    yield chunk
            finally:
                pass

        return StreamingResponse(stream_response(), media_type="text/plain")
    except Exception as e:
        logger.error(f"Error during completion: {e}", exc_info=True)
        return {"error": "Internal server error"}

# Utility function to wrap a regular generator as an async generator
async def async_generator_wrapper(generator):
    for item in generator:
        yield item

@app.get("/api/llm/models")
async def get_llm_models():
    llm._load_available_models()
    return JSONResponse(content={"models": llm.all_model_data, "currentModel": llm.current_model_data})

# *******************************
# Model Download
# *******************************

class DownloadModelRequest(BaseModel):
    model_id: str  # This could be displayName or fileName

@app.post("/api/llm/models/download")
async def download_model(request: DownloadModelRequest):
    """Download a model to the appropriate folder"""
    try:
        # Find the model in the available models
        target_model = None
        for model in llm.all_model_data:
            if (model.get('displayName') == request.model_id or 
                model.get('fileName') == request.model_id):
                target_model = model
                break
        
        if not target_model:
            return JSONResponse(status_code=404, content={"error": "Model not found"})
        
        model_name = target_model.get('fileName')
        download_url = target_model.get('link')
        
        if not download_url:
            return JSONResponse(status_code=400, content={"error": "No download URL available for this model"})
        
        # Determine the target folder and file path
        if 'model_folder' in target_model:
            target_folder = target_model['model_folder']
        else:
            # Create folder based on model name (without extension)
            folder_name = os.path.splitext(model_name)[0]
            target_folder = os.path.join(llm.models_directory, folder_name)
        
        # Create the folder if it doesn't exist
        os.makedirs(target_folder, exist_ok=True)
        
        target_file_path = os.path.join(target_folder, model_name)
        
        # Check if file already exists
        if os.path.exists(target_file_path):
            return JSONResponse(status_code=409, content={
                "error": "Model already exists", 
                "message": "Delete the model first before downloading again"
            })
        
        # Start the download in the background
        download_id = f"{model_name}_{int(time.time())}"
        download_progress[download_id] = {
            'model_name': model_name,
            'status': 'starting',
            'progress': 0,
            'total_size': 0,
            'downloaded_size': 0,
            'error': None,
            'start_time': time.time()
        }
        
        # Start background download task
        asyncio.create_task(download_model_file(download_id, download_url, target_file_path))
        
        return JSONResponse(content={
            "message": "Download started",
            "download_id": download_id,
            "target_path": target_file_path
        })
        
    except Exception as e:
        logger.error(f"Error starting model download: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to start download"})

async def download_model_file(download_id: str, url: str, target_path: str):
    """Download a model file with progress tracking"""
    try:
        download_progress[download_id]['status'] = 'downloading'
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"HTTP {response.status}: {await response.text()}")
                
                total_size = int(response.headers.get('Content-Length', 0))
                download_progress[download_id]['total_size'] = total_size
                
                downloaded_size = 0
                
                # Create a temporary file first
                temp_path = target_path + '.tmp'
                
                async with aiofiles.open(temp_path, 'wb') as file:
                    async for chunk in response.content.iter_chunked(8192):
                        await file.write(chunk)
                        downloaded_size += len(chunk)
                        
                        # Update progress
                        progress = (downloaded_size / total_size * 100) if total_size > 0 else 0
                        download_progress[download_id].update({
                            'progress': progress,
                            'downloaded_size': downloaded_size
                        })
                
                # Move temp file to final location
                if os.path.exists(target_path):
                    os.remove(target_path)
                os.rename(temp_path, target_path)
                
                # Mark as completed
                download_progress[download_id]['status'] = 'completed'
                download_progress[download_id]['progress'] = 100
                
                logger.info(f"Model download completed: {target_path}")
                
                # Refresh model list to update file existence status
                llm._load_available_models()
                
    except Exception as e:
        logger.error(f"Model download failed for {download_id}: {e}")
        download_progress[download_id]['status'] = 'error'
        download_progress[download_id]['error'] = str(e)
        
        # Clean up temp file if it exists
        temp_path = target_path + '.tmp'
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/llm/models/download/{download_id}/progress")
async def get_download_progress(download_id: str):
    """Get the progress of a model download"""
    if download_id not in download_progress:
        return JSONResponse(status_code=404, content={"error": "Download ID not found"})
    
    progress_info = download_progress[download_id].copy()
    
    # Add elapsed time
    progress_info['elapsed_time'] = time.time() - progress_info['start_time']
    
    # Calculate download speed if downloading
    if progress_info['status'] == 'downloading' and progress_info['elapsed_time'] > 0:
        speed = progress_info['downloaded_size'] / progress_info['elapsed_time']
        progress_info['download_speed'] = f"{llm._format_file_size(speed)}/s"
    
    return JSONResponse(content=progress_info)

@app.delete("/api/llm/models/download/{download_id}")
async def cancel_download(download_id: str):
    """Cancel a model download"""
    if download_id not in download_progress:
        return JSONResponse(status_code=404, content={"error": "Download ID not found"})
    
    if download_progress[download_id]['status'] in ['completed', 'error']:
        return JSONResponse(status_code=400, content={"error": "Download cannot be cancelled"})
    
    download_progress[download_id]['status'] = 'cancelled'
    return JSONResponse(content={"message": "Download cancelled"})

@app.get("/api/llm/models/downloads")
async def get_all_downloads():
    """Get status of all downloads"""
    return JSONResponse(content={"downloads": download_progress})

class DeleteModelRequest(BaseModel):
    model_id: str  # This could be displayName or fileName

@app.delete("/api/llm/models/delete")
async def delete_model(request: DeleteModelRequest):
    """Delete a downloaded model file"""
    try:
        # Find the model in the available models
        target_model = None
        for model in llm.all_model_data:
            if (model.get('displayName') == request.model_id or 
                model.get('fileName') == request.model_id):
                target_model = model
                break
        
        if not target_model:
            return JSONResponse(status_code=404, content={"error": "Model not found"})
        
        model_name = target_model.get('fileName')
        
        # Determine the model file path
        if 'model_folder' in target_model:
            target_folder = target_model['model_folder']
        else:
            # Fallback to old method
            folder_name = os.path.splitext(model_name)[0]
            target_folder = os.path.join(llm.models_directory, folder_name)
        
        target_file_path = os.path.join(target_folder, model_name)
        
        # Check if file exists
        if not os.path.exists(target_file_path):
            return JSONResponse(status_code=404, content={"error": "Model file not found"})
        
        # Check if this is the currently loaded model
        if llm.current_model_data and llm.current_model_data.get('fileName') == model_name:
            if llm.llm:
                llm.unload_model()
        
        # Delete the model file
        os.remove(target_file_path)
        logger.info(f"Deleted model file: {target_file_path}")
        
        # For vision models, also delete mmproj file if it exists
        if target_model.get('type') == 'vision':
            mmproj_path = target_model.get('mmproj_path')
            if mmproj_path:
                full_mmproj_path = os.path.join(target_folder, mmproj_path)
                if os.path.exists(full_mmproj_path):
                    os.remove(full_mmproj_path)
                    logger.info(f"Deleted mmproj file: {full_mmproj_path}")
        
        # Refresh model list to update file existence status
        llm._load_available_models()
        
        return JSONResponse(content={
            "message": "Model deleted successfully",
            "deleted_file": target_file_path
        })
        
    except Exception as e:
        logger.error(f"Error deleting model: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to delete model"})

# *******************************
# TTS
# *******************************

class TTSRequest(BaseModel):
    text: str

class ChangeVoiceRequest(BaseModel):
    voice_name: str

@app.get("/api/tts/voices")
async def get_available_voices():
    try:
        voices = tts.get_available_voices()
        return JSONResponse(content={
            "voices": voices,
            "current_voice": tts.current_voice
        })
    except Exception as e:
        logger.error(f"Error getting voices: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to get available voices"})

@app.post("/api/tts/voice")
async def change_voice(request: ChangeVoiceRequest):
    try:
        result = tts.change_voice(request.voice_name)
        settings_manager.update_settings({"tts.voice": request.voice_name})
        return JSONResponse(content=result)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        logger.error(f"Error changing voice: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to change voice"})

@app.post("/api/tts")
async def get_audio(request: TTSRequest):
    response = tts.syntheize(request.text)
    return Response(response, media_type="audio/wav")
    
# *******************************
# Character Models
# *******************************

@app.get("/api/character/live2d/models")
async def get_live2d_models():
    """Get all available Live2D models"""
    try:
        models = character_manager.get_live2d_models()
        return JSONResponse(content={"models": models})
    except Exception as e:
        logger.error(f"Error getting Live2D models: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to get Live2D models"})

@app.get("/api/character/vrm/models")
async def get_vrm_models():
    """Get all available VRM models"""
    try:
        models = character_manager.get_vrm_models()
        return JSONResponse(content={"models": models})
    except Exception as e:
        logger.error(f"Error getting VRM models: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to get VRM models"})

@app.get("/api/character/files/{file_path:path}")
async def serve_character_files(file_path: str, request: Request):
    """Serve character model files from backend"""
    try:
        # Get the full request path
        full_path = request.url.path
        
        # Get the absolute file path using CharacterManager
        absolute_path = character_manager.get_file_path(full_path)
        
        if absolute_path is None:
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(str(absolute_path))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving character file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/character/vrm/upload")
async def upload_vrm_model(file: UploadFile = File(...)):
    """Upload a VRM model file"""
    try:
        # Read file content
        file_data = await file.read()
        
        # Upload using character manager
        success, message = character_manager.upload_vrm_model(file_data, file.filename)
        
        if success:
            return JSONResponse(status_code=200, content={"message": message})
        else:
            return JSONResponse(status_code=400, content={"error": message})
            
    except Exception as e:
        logger.error(f"Error uploading VRM model: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to upload model"})

@app.post("/api/character/live2d/upload-folder")
async def upload_live2d_folder(files: List[UploadFile] = File(...)):
    """Upload a Live2D model folder"""
    try:
        # Read all files and their relative paths
        file_data = []
        for file in files:
            content = await file.read()
            file_data.append((file.filename, content))
        
        # Upload using character manager
        success, message = character_manager.upload_live2d_folder(file_data)
        
        if success:
            return JSONResponse(status_code=200, content={"message": message})
        else:
            return JSONResponse(status_code=400, content={"error": message})
            
    except Exception as e:
        logger.error(f"Error uploading Live2D model folder: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to upload model folder"})

class DeleteModelRequest(BaseModel):
    path: str

@app.post("/api/character/vrm/delete")
async def delete_vrm_model(request: DeleteModelRequest):
    """Delete a VRM model"""
    try:
        success, message = character_manager.delete_vrm_model(request.path)
        
        if success:
            return JSONResponse(status_code=200, content={"message": message})
        else:
            return JSONResponse(status_code=400, content={"error": message})
            
    except Exception as e:
        logger.error(f"Error deleting VRM model: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to delete model"})

@app.post("/api/character/live2d/delete")
async def delete_live2d_model(request: DeleteModelRequest):
    """Delete a Live2D model folder"""
    try:
        success, message = character_manager.delete_live2d_model(request.path)
        
        if success:
            return JSONResponse(status_code=200, content={"message": message})
        else:
            return JSONResponse(status_code=400, content={"error": message})
            
    except Exception as e:
        logger.error(f"Error deleting Live2D model: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to delete model"})

# *******************************
# Settings
# *******************************

class SettingsManager:
    def __init__(self, settings_file: str):
        self.settings_file = settings_file
        self.settings = self.load_settings()

    def load_settings(self) -> Dict[str, Any]:
        if not os.path.exists(self.settings_file):
            return {}
        with open(self.settings_file, "r") as file:
            return json.load(file)

    def save_settings(self, settings: Dict[str, Any]):
        with open(self.settings_file, "w") as file:
            json.dump(settings, file, indent=4)

    def apply_settings(self):
        # Create a copy of items to avoid modification during iteration
        settings_items = list(self.settings.items())
        
        for key, value in settings_items:
            if key == "llm.model_filename":
                llm.load_model_by_filename(value)
        
        for key, value in settings_items:
            if key == "llm.keep_model_loaded":
                llm.set_keep_model_loaded(value)
            if key == "stream.yt.videoid":
                chat_fetch.video_id = value
            if key == "tts.voice":
                try:
                    tts.change_voice(value)
                except ValueError:
                    # If saved voice is not available, remove it from settings
                    logger.warning(f"Saved voice '{value}' not found, removing from settings")
                    self.settings.pop("tts.voice")
                    self.save_settings(self.settings)
        
        # Apply LLM sampling parameters
        llm_sampling_params = {}
        for key, value in settings_items:
            if key.startswith("llm.") and key.split(".", 1)[1] in ["top_k", "top_p", "min_p", "repeat_penalty", "temperature", "seed"]:
                param_name = key.split(".", 1)[1]
                try:
                    # Convert to appropriate type
                    if param_name == "seed":
                        llm_sampling_params[param_name] = int(value)
                    elif param_name in ["top_k"]:
                        llm_sampling_params[param_name] = int(value)
                    else:
                        llm_sampling_params[param_name] = float(value)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid value for {key}: {value}, using default")
        
        if llm_sampling_params:
            llm.update_sampling_params(llm_sampling_params)

    def update_settings(self, updated_settings: Dict[str, Any]):
        self.settings.update(updated_settings)
        self.save_settings(self.settings)
        self.apply_settings()

# Initialize the SettingsManager
SETTINGS_FILE = "settings.json"
settings_manager = SettingsManager(SETTINGS_FILE)

# Apply settings on startup
start_time = time.time()
startup_progress.show_step("Applying Settings")
settings_manager.apply_settings()
startup_progress.complete_step(f"Settings applied in {time.time() - start_time:.2f}s")

# Warm up TTS to reduce first request latency
start_time = time.time()
startup_progress.show_step("Warming up TTS")
try:
    tts.syntheize("Hi")
    startup_progress.complete_step(f"TTS warmed up successfully in {time.time() - start_time:.2f}s")
except Exception as e:
    startup_progress.complete_step(f"TTS warm-up failed (non-critical) in {time.time() - start_time:.2f}s")
    logger.warning(f"TTS warm-up failed (non-critical): {e}")

# Log startup time
startup_time = time.time() - total_start_time
startup_progress.complete_step(f"✅ Server Ready in {startup_time:.2f}s at {datetime.now().strftime('%H:%M:%S')}")

# *******************************
# Settings API
# *******************************

class UpdateSettingsRequest(BaseModel):
    settings: Dict[str, Any]

@app.post("/api/settings/update")
async def update_settings(request: UpdateSettingsRequest):
    try:
        settings_manager.update_settings(request.settings)
        return JSONResponse(content={"status": "ok", "message": "Settings updated successfully"})
    except ValueError as ve:
        logger.error(f"Validation error: {ve}, traceback: {traceback.format_exc()}")
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        logger.error(f"Error updating settings: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to update settings"})

@app.get("/api/settings")
async def get_settings():
    return JSONResponse(content={
        "settings": settings_manager.settings
    })

# *******************************
# Chat History API
# *******************************

class CreateSessionRequest(BaseModel):
    title: str

@app.post("/api/chat/session/create")
async def create_chat_session(request: CreateSessionRequest):
    try:
        session = history_store.create_session(request.title)
        return JSONResponse(status_code=200, content=session)
    except Exception as e:
        logger.error(f"Error creating chat session: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to create chat session"})

class UpdateSessionRequest(BaseModel):
    session_id: str
    history: List[Dict[str, str]]

@app.post("/api/chat/session/update")
async def update_chat_session(request: UpdateSessionRequest):
    try:
        success = history_store.update_session(request.session_id, request.history)
        if success:
            return JSONResponse(status_code=200, content={"message": "Session updated successfully"})
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    except Exception as e:
        logger.error(f"Error updating chat session: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to update chat session"})

class UpdateSessionTitleRequest(BaseModel):
    session_id: str
    title: str

@app.post("/api/chat/session/update-title")
async def update_chat_session_title(request: UpdateSessionTitleRequest):
    try:
        success = history_store.update_session_title(request.session_id, request.title)
        if success:
            return JSONResponse(status_code=200, content={"message": "Session title updated successfully"})
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    except Exception as e:
        logger.error(f"Error updating chat session title: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to update chat session title"})

@app.get("/api/chat/sessions")
async def get_chat_sessions():
    try:
        sessions = history_store.get_session_list()
        return JSONResponse(status_code=200, content=sessions)
    except Exception as e:
        logger.error(f"Error getting chat sessions: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to get chat sessions"})

@app.get("/api/chat/session/{session_id}")
async def get_chat_session(session_id: str):
    try:
        session = history_store.get_session_history(session_id)
        if session:
            return JSONResponse(status_code=200, content=session)
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    except Exception as e:
        logger.error(f"Error getting chat session: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to get chat session"})

@app.delete("/api/chat/session/{session_id}")
async def delete_chat_session(session_id: str):
    try:
        success = history_store.delete_session(session_id)
        if success:
            return JSONResponse(status_code=200, content={"message": "Session deleted successfully"})
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    except Exception as e:
        logger.error(f"Error deleting chat session: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to delete chat session"})

# *******************************
# Session Indexing API
# *******************************

class IndexSessionRequest(BaseModel):
    session_id: str
    window_size: int = 3
    stride: int = 1
    format_style: str = "simple"

@app.post("/api/chat/session/{session_id}/index")
async def index_chat_session(session_id: str, request: IndexSessionRequest):
    try:
        # Get the session history
        session = history_store.get_session_history(session_id)
        if not session:
            return JSONResponse(status_code=404, content={"error": "Session not found"})
        
        history = session.get("history", [])
        if not history:
            return JSONResponse(status_code=400, content={"error": "Session has no history to index"})
        
        # Insert the history into memory using the new chunking functionality
        response = memory.insert_history(
            history=history,
            session_id=session_id,
            window_size=request.window_size,
            stride=request.stride,
            format_style=request.format_style
        )
        
        if response is None:
            return JSONResponse(status_code=500, content={"error": "Failed to index session"})
        
        # Mark the session as indexed
        history_store.mark_session_indexed(session_id, True)
        
        return JSONResponse(status_code=200, content={
            "message": "Session indexed successfully",
            "chunks_created": len(history) // request.window_size + 1 if len(history) > 0 else 0
        })
        
    except Exception as e:
        logger.error(f"Error indexing chat session: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to index chat session"})

@app.delete("/api/chat/session/{session_id}/index")
async def remove_session_index(session_id: str):
    try:
        # Check if session exists
        session = history_store.get_session_history(session_id)
        if not session:
            return JSONResponse(status_code=404, content={"error": "Session not found"})
        
        # Remove all messages for this session from memory
        success = memory.delete_session_messages(session_id)
        
        if not success:
            return JSONResponse(status_code=500, content={"error": "Failed to remove session from memory"})
        
        # Mark the session as not indexed
        history_store.mark_session_indexed(session_id, False)
        
        return JSONResponse(status_code=200, content={"message": "Session index removed successfully"})
        
    except Exception as e:
        logger.error(f"Error removing session index: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to remove session index"})

@app.get("/api/chat/session/{session_id}/index/status")
async def get_session_index_status(session_id: str):
    try:
        session = history_store.get_session_history(session_id)
        if not session:
            return JSONResponse(status_code=404, content={"error": "Session not found"})
        
        return JSONResponse(status_code=200, content={
            "session_id": session_id,
            "indexed": session.get("indexed", False),
            "indexed_at": session.get("indexed_at"),
            "message_count": len(session.get("history", []))
        })
        
    except Exception as e:
        logger.error(f"Error getting session index status: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to get session index status"})

@app.get("/api/chat/session/{session_id}/indexed")
async def get_indexed_chunks(session_id: str):
    try:
        # Fetch all indexed chunks for the session
        chunks = memory.query_by_session(session_id, limit=1000)
        return JSONResponse(status_code=200, content={"chunks": chunks})
    except Exception as e:
        logger.error(f"Error getting indexed chunks for session {session_id}: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to get indexed chunks"})

@app.post("/api/chat/reindex-all")
async def reindex_all_sessions():
    try:
        # Get all sessions
        sessions = history_store.get_session_list()
        if not sessions:
            return JSONResponse(status_code=200, content={"message": "No sessions to reindex"})
        
        # Delete all existing indexes
        success = memory.delete_all_messages()
        if not success:
            return JSONResponse(status_code=500, content={"error": "Failed to delete existing indexes"})
        
        # Mark all sessions as not indexed
        for session in sessions:
            history_store.mark_session_indexed(session["id"], False)
        
        # Reindex all sessions with history
        reindexed_count = 0
        failed_sessions = []
        
        for session in sessions:
            try:
                session_data = history_store.get_session_history(session["id"])
                if session_data and session_data.get("history"):
                    # Insert the history into memory
                    response = memory.insert_history(
                        history=session_data["history"],
                        session_id=session["id"],
                        window_size=3,
                        stride=1,
                        format_style="simple"
                    )
                    
                    if response is not None:
                        # Mark the session as indexed
                        history_store.mark_session_indexed(session["id"], True)
                        reindexed_count += 1
                    else:
                        failed_sessions.append(session["id"])
                else:
                    failed_sessions.append(session["id"])
            except Exception as e:
                logger.error(f"Error reindexing session {session['id']}: {e}")
                failed_sessions.append(session["id"])
        
        return JSONResponse(status_code=200, content={
            "message": "Reindexing completed",
            "reindexed_count": reindexed_count,
            "failed_sessions": failed_sessions,
            "total_sessions": len(sessions)
        })
        
    except Exception as e:
        logger.error(f"Error reindexing all sessions: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to reindex all sessions"})

# *******************************
# Memory - Context Query API
# *******************************

class QueryContextRequest(BaseModel):
    text: str
    limit: int = 3

@app.post("/api/memory/context")
async def query_memory_context(request: QueryContextRequest):
    try:
        response = memory.query(text=request.text, limit=request.limit)
        return JSONResponse(status_code=200, content={"context": response})
    except Exception as e:
        logger.error(f"Error querying memory context: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Failed to query memory context"})

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)
