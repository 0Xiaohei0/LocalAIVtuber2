from services.Memory.Memory import Memory
from services.lib.LAV_logger import logger
import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from services.LLM.LLM import LLM
from pydantic import BaseModel

app = FastAPI()
static_files_path = os.path.abspath("../frontend/dist")
app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")

# Initialize Services
llm:LLM = LLM()
memory:Memory = Memory()

class LLMRequest(BaseModel):
    text: str
    history: list | None = None
    systemPrompt: str = ""
    screenshot: bool = False

@app.get("/")
async def serve_webui():
    return FileResponse("../frontend/dist/index.html")

@app.post("/api/completion")
async def get_completion(request: LLMRequest):
    try:
        response = llm.get_completion(request.text, request.history, request.systemPrompt, request.screenshot)
        if response is None:
            return {"error": "No response from LLM service"}
        return StreamingResponse(response, media_type="text/plain")
    except Exception as e:
        logger.error(f"Error during completion: {e}", exc_info=True)
    finally:
        llm.unload_model()

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
    speaker: str = ""

@app.post("/api/memory/insert")
async def insert_memory(request: InsertMemoryRequest):
    response = memory.insert(text=request.text, speaker = request.speaker)
    logger.info(response)
    if response is None:
        return {"error": "No response from Memory service"}
    return response

class GetMemoryRequest(BaseModel):
    limit : int = 50
    offset: int = 0

@app.post("/api/memory")
async def get_memory(request: GetMemoryRequest):
    response = memory.get(request.limit, request.offset)
    if response is None:
        return {"error": "No response from Memory service"}
    return response
    

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
