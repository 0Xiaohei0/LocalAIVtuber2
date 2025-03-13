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

class LLMRequest(BaseModel):
    text: str
    history: list | None = None
    systemPrompt: str = ""
    screenshot: bool = False

@app.get("/api/completion")
async def get_completion(request: LLMRequest):
    response = llm.get_completion(request.text, request.history, request.systemPrompt, request.screenshot)
    return StreamingResponse(response, media_type="text/plain")

@app.get("/")
async def serve_webui():
    return FileResponse("../frontend/dist/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
