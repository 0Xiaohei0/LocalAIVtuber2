# Local AI Vtuber 2 (Fully local AI vtuber that can see your screen and talk in real time)

Full demo and setup guide:

- All AI models run locally.
- Can chat about what's on your screen.
- Can be interrupted mid-sentence.
- Modern web UI with 2D and 3D character rendering.
- Custom finetuned language model for more interesting conversations.
- Long term memory storage and retrieval.
- Can edit conversations and export as training data.

  
<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/f2a88171-f99b-4a78-a0d7-a03cc380c841" /></td>
    <td><img src="https://github.com/user-attachments/assets/26ccf81d-bfe7-444f-944b-116fb7af4fa5" /></td>
  </tr>
</table>

## Download
You can download the release package here:
https://huggingface.co/xiaoheiqaq/LocalAiVtuber2-windows-package/resolve/main/LocalAIVtuber2.zip?download=true

## Installation

### 1. Install python 3.10
https://www.python.org/downloads/release/python-3100/

### 2. Install CUDA toolkit 12.4
https://developer.nvidia.com/cuda-12-4-0-download-archive

### 3. Create environemnt
```
cd backend
python -m venv venv
.\venv\Scripts\activate
```

### 3. Install dependencies
```
pip install llama-cpp-python==0.2.90 --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu124
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install fastapi uvicorn qdrant-client[fastembed] pyautogui  sounddevice silero-vad easyocr==1.7.2 mss numpy==1.23.4 pytchat
pip install -r services\TTS\GPTsovits\requirements.txt
```

### 4. Start program
```
.\venv\Scripts\activate
python server.py
```

After setup, you can also double click the ```start.bat``` file to start the program without needing to open the terminal.



## Setting up from a clone
This is for if you want to clone the repo for contributing to this project

### 1. Clone the repo and follow the envrionemnt setup as described above


### 2. Get the pretrained TTS model from the release package
Copy this folder in the release package 
```backend\services\TTS\GPTsovits\GPT_SoVITS\pretrained_models``` to the same location in the cloned project.


### 3. Get ffmpeg from the release package
Copy ```backend\ffmpeg.exe``` and ```backend\ffprobe.exe``` to same path in cloned project


### 4. Build frontend

Install nodejs https://nodejs.org/en/download

```
cd frontend
npm i
npm run build
```

The project should be ready for development.
