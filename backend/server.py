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
    # try:
        response = llm.get_completion(request.text, request.history, request.systemPrompt, request.screenshot)
        if response is None:
            return {"error": "No response from LLM service"}
        return StreamingResponse(response, media_type="text/plain")
    # except Exception as e:
    #     return {"error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
