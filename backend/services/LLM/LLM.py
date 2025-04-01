import json
import os
from services.lib.LAV_logger import logger

from .BaseLLM import BaseLLM
from .TextLLM import TextLLM
from .VisionLLM import VisionLLM


class LLM:
    def __init__(self, gpu_layers=-1):
        self.current_module_directory = os.path.dirname(__file__)
        self.model_data_path = os.path.join(self.current_module_directory, "model_data.json")

        self.current_model_data = None
        self.llm: BaseLLM | None = None
        self.all_model_data = None
        self.keep_model_loaded = False

        if os.path.exists(self.model_data_path):
            with open(self.model_data_path, 'r') as f:
                self.all_model_data = json.load(f)
                if self.all_model_data:
                    self.current_model_data = self.all_model_data[0]
        if self.keep_model_loaded:
            self.load_model(self.current_model_data, gpu_layers)
        
    def load_model(self, model_data: dict, gpu_layers=-1):
        logger.info(f"Loading model {model_data}...")
        if (self.llm and self.current_model_data.get('fileName') == model_data.get('fileName')):
            logger.info(f"Same model already loaded, load cancelled...")
            return
        self.current_model_data = model_data
        model_directory = os.path.join(self.current_module_directory, "Models")
        model_filename = model_data.get("fileName")
        model_path = os.path.join(model_directory, model_filename)

        if not os.path.exists(model_path):
            logger.error(f"Model {model_filename} not found. Please press download to download the model.")
            return
        else:
            self.unload_model()
            if model_data.get("type") == "text":
                self.llm = TextLLM(model_path=model_path, n_ctx=4096, n_gpu_layers=gpu_layers, seed=-1)
            elif model_data.get("type") == "vision":
                self.llm = VisionLLM(model_path=model_path, mmproj_path=model_data.get("mmproj_path"), n_ctx = 4096, n_gpu_layers=gpu_layers, seed=-1)

            logger.info(f"Model changed to {model_filename}.")

    def unload_model(self):
        if self.llm:
            del self.llm
            self.llm = None
            logger.info("Model unloaded.")

    def set_keep_model_loaded(self, value):
        self.keep_model_loaded = value
        if value == True:
            self.load_model(self.current_model_data)
        else:
            self.unload_model()
        

    def get_completion(self, text, history, system_prompt, screenshot=False):
        if not self.llm:
            self.load_model(self.current_model_data)

        response = None
        if isinstance(self.llm, VisionLLM):
            self.llm: VisionLLM
            response = self.llm.get_chat_completion(text, history, system_prompt, screenshot)
        elif isinstance(self.llm, TextLLM):
            self.llm: TextLLM
            response = self.llm.get_chat_completion(text, history, system_prompt)
        if not self.keep_model_loaded:
            self.unload_model()
        return response