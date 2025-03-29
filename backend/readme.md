
```
python -m venv venv
.\venv\Scripts\activate
pip install llama-cpp-python==0.2.90 --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu124
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install fastapi uvicorn qdrant-client[fastembed] pyautogui 
pip install -r services\TTS\GPTsovits\requirements.txt
```
