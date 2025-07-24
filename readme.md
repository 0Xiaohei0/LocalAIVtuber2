# Local AI Vtuber 2 (Fully local AI vtuber that can see your screen and talk in real time)

Full demo and setup guide: https://youtu.be/gD1y4by3CPg?si=oinKcReuUd5xzjKT

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

## FAQ
### How to add character models
1. Add your live2d model folder to ```frontend\public\resource\live2D\models``` or for vrm 3d models ```frontend\public\resource\VRM3D\models```. For example, if you want to add a new live2d model called pachan 2.0, put the files here
   <img width="521" height="368" alt="image" src="https://github.com/user-attachments/assets/06f0a983-0ced-484d-a40e-e55b5a763b2f" />

2. Add the path to the ```.model3.json``` or ```.vrm``` to ```frontend\src\components\character-render.tsx```, for example:
```
const AVAILABLE_LIVE2D_MODELS: Live2DModel[] = [
    {
        name: "akari_vts/akari",
        path: "/resource/live2D/models/akari_vts/akari.model3.json"
    },
    {
        name: "KITU17/haru",
        path: "/resource/live2D/models/KITU17/KITU17.model3.json"
    }
    // ===============add this entry here==============
    ,
    {
        name: "pachan 2.0 or you can pick any name",
        path: "/resource/live2D/models/pachan 2.0/pachirisu anime girl - top half.model3.json"
    }
    // ===============add this entry here==============
]
```
3. Install nodejs https://nodejs.org/en/download
4. build frontend:
```
cd frontend
npm i
npm run build
```

Model should show up
<img width="307" height="179" alt="image" src="https://github.com/user-attachments/assets/6ca522f5-a70e-4286-b76a-f0e3071ae71c" />

Live 2d models may not be properly positioned depending on your model, you can adjust the scale and position here:
https://github.com/0Xiaohei0/LocalAIVtuber2/blob/df0985f028adebb2a9525fc415d54e639d9811d1/frontend/src/components/live-2d-renderer.tsx#L40

use ```npm run dev``` and go to http://localhost:5173/ to test parameters without rebuilding.

(Will improve this process in the next version)

### How to add new voices
1. Get a 3 to 10 second audio clip of the voice saying a sentence in English, change the filename to the same sentence.
2. Create a folder here and place the audio file inside, currently only .wav format works. ```backend\services\TTS\models\leaf\The birch canoe slid on the smooth planks. Glue the sheet to the dark blue background.wav```

New voice should show up in UI.
