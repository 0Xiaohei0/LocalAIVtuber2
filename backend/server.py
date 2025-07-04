import asyncio
from services.ChatFetch.Chatfetch import ChatFetch
from services.Input.Input import VoiceInput
from services.TTS.TTS import TTS
from services.Memory.Memory import Memory
from services.Memory.HistoryStore import HistoryStore
from services.lib.LAV_logger import logger
import os
from fastapi import FastAPI, Query, Request, Response, WebSocket
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from services.LLM.LLM import LLM
from pydantic import BaseModel
import time
from datetime import datetime
import json
from typing import Any, Dict, List

app = FastAPI()
static_files_path = os.path.abspath("../frontend/dist")
app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")
app.mount("/resource", StaticFiles(directory="../frontend/dist/resource"), name="resource")

# Initialize Services
start_time = time.time()
voice_input:VoiceInput = VoiceInput()
llm:LLM = LLM()
memory:Memory = Memory()
history_store:HistoryStore = HistoryStore()
tts:TTS = TTS()

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
            
        response = llm.llm.complete_current_response(request.history, request.systemPrompt)
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
# Memory - Messages
# *******************************

# class QueryMemoryRequest(BaseModel):
#     text: str
#     limit: int = 3

# @app.post("/api/memory/query")
# async def query_memory(request: QueryMemoryRequest):
#     response = memory.query(text=request.text, limit = request.limit)
#     if response is None:
#         return JSONResponse(status_code=400, content={"error": "session_id must not be empty"})
#     return JSONResponse(status_code=200, content=response)

# class InsertMemoryRequest(BaseModel):
#     text: str
#     role: str = ""
#     name: str = ""
#     session_id: str = ""

# @app.post("/api/memory/insert")
# async def insert_memory(request: InsertMemoryRequest):
#     if (not request.session_id):
#         return JSONResponse(status_code=400, content={"error": "session_id must not be empty"})
#     response = memory.insert_message(message=request.text, role=request.role, name=request.name, session_id=request.session_id)
#     logger.info(response)
#     if response is None:
#         return JSONResponse(status_code=400, content={"error": "No response from Memory service"})
#     return JSONResponse(status_code=200, content={"message": "Memory inserted.", "response": response})

# class NewSessionRequest(BaseModel):
#     session_id: str
#     title: str


# *******************************
# Memory - Session
# *******************************

# @app.post("/api/memory/session/new")
# async def create_new_session(request: NewSessionRequest):
#     response = memory.upsert_session(session_id=request.session_id, title=request.title)
#     if response is None:
#         return JSONResponse(status_code=400, content={"error": "Failed to create session"})
#     return JSONResponse(status_code=200, content={"message": "Session created.", "response": response})

# class DeleteSessionRequest(BaseModel):
#     session_id: str

# @app.post("/api/memory/session/delete")
# async def delete_session(request: DeleteSessionRequest):
#     response = memory.delete_session(session_id=request.session_id)
#     if response is None:
#         return JSONResponse(status_code=400, content={"error": "Failed to create session"})
#     return JSONResponse(status_code=200, content={"message": "Session deleted.", "response": response})

# @app.get("/api/memory/session")
# async def get_memory_sessions():
#     response = memory.get_sessions()
#     if response is None:
#         return []
#     return response

# @app.get("/api/memory/session/messages")
# async def get_session_messages(session_id: str = Query(...)):
#     response = memory.get_messages_by_session(session_id=session_id)
#     if response is None:
#         return JSONResponse(status_code=400, content={"error": "Failed to get messages."})
#     return JSONResponse(status_code=200, content={"message": "Message retrieved.", "response": response})


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
            if key == "llm.keep_model_loaded":
                llm.set_keep_model_loaded(value)
            if key == "llm.model_filename":
                llm.load_model_by_filename(value)
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

    def update_settings(self, updated_settings: Dict[str, Any]):
        self.settings.update(updated_settings)
        self.save_settings(self.settings)
        self.apply_settings()

# Initialize the SettingsManager
SETTINGS_FILE = "settings.json"
settings_manager = SettingsManager(SETTINGS_FILE)

# Apply settings on startup
settings_manager.apply_settings()

# Log startup time
startup_time = time.time() - start_time
logger.info(f"Server started in {startup_time:.2f} seconds at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

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
        logger.error(f"Validation error: {ve}")
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
