import asyncio
from services.Input.Input import VoiceInput
from services.TTS.TTS import TTS
from services.Memory.Memory import Memory
from services.lib.LAV_logger import logger
import os
from fastapi import FastAPI, Query, Request, Response, WebSocket
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from services.LLM.LLM import LLM
from pydantic import BaseModel

app = FastAPI()
static_files_path = os.path.abspath("../frontend/dist")
app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")

# Initialize Services
voice_input:VoiceInput = VoiceInput()
llm:LLM = LLM()
memory:Memory = Memory()
tts:TTS = TTS()

clients = set()


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
# LLM
# *******************************

class LLMRequest(BaseModel):
    text: str
    history: list | None = None
    systemPrompt: str = ""
    screenshot: bool = False

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

# Utility function to wrap a regular generator as an async generator
async def async_generator_wrapper(generator):
    for item in generator:
        yield item


# *******************************
# Memory - Messages
# *******************************

class QueryMemoryRequest(BaseModel):
    text: str
    limit: int = 3

@app.post("/api/memory/query")
async def query_memory(request: QueryMemoryRequest):
    response = memory.query(text=request.text, limit = request.limit)
    if response is None:
        return {"error": "No response from Memory service"}
    return response

class InsertMemoryRequest(BaseModel):
    text: str
    role: str = ""
    name: str = ""
    session_id: str = ""

@app.post("/api/memory/insert")
async def insert_memory(request: InsertMemoryRequest):
    response = memory.insert_message(message=request.text, role=request.role, name=request.name, session_id=request.session_id)
    logger.info(response)
    if response is None:
        return {"error": "No response from Memory service"}
    return response

class NewSessionRequest(BaseModel):
    session_id: str
    title: str


# *******************************
# Memory - Session
# *******************************

@app.post("/api/memory/session/new")
async def create_new_session(request: NewSessionRequest):
    response = memory.upsert_session(session_id=request.session_id, title=request.title)
    if response is None:
        return {"error": "Failed to create session"}
    return {"status": "ok", "session_id": request.session_id}

class DeleteSessionRequest(BaseModel):
    session_id: str

@app.post("/api/memory/session/delete")
async def delete_session(request: DeleteSessionRequest):
    response = memory.delete_session(session_id=request.session_id)
    if response is None:
        return {"error": "Failed to delete session"}
    return {"status": "ok", "session_id": request.session_id}

@app.get("/api/memory/session")
async def get_memory_sessions():
    response = memory.get_sessions()
    if response is None:
        return []
    return response

@app.get("/api/memory/session/messages")
async def get_session_messages(session_id: str = Query(...)):
    response = memory.get_messages_by_session(session_id=session_id)
    if response is None:
        return {"error": "Failed to get messages."}
    return response

class TTSRequest(BaseModel):
    text: str


# *******************************
# TTS
# *******************************

@app.post("/api/tts")
async def get_audio(request: TTSRequest):
    response = tts.syntheize(request.text)
    return Response(response, media_type="audio/wav")
    

# *******************************
# Settings
# *******************************

class UpdateSettingsRequest(BaseModel):
    settings: dict

@app.post("/api/settings/update")
async def update_settings(request: UpdateSettingsRequest):
    try:
        updated_settings = request.settings

        # Example: Apply settings to LLM
        if "llm" in updated_settings:
            llm_settings = updated_settings["llm"]
            if "keep_model_loaded" in llm_settings:
                llm.set_keep_model_loaded(llm_settings["keep_model_loaded"])

        return {"status": "ok", "message": "Settings updated successfully"}
    except Exception as e:
        logger.error(f"Error updating settings: {e}", exc_info=True)
        return {"error": "Failed to update settings"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
