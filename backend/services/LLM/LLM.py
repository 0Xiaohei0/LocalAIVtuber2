import json
import os

from .BaseLLM import BaseLLM
from .TextLLM import TextLLM
from .VisionLLM import VisionLLM


class LLM:
    def __init__(self):
        self.current_module_directory = os.path.dirname(__file__)
        self.model_data_path = os.path.join(self.current_module_directory, "model_data.json")

        self.current_model_data = None
        self.llm: BaseLLM | None = None
        self.all_model_data = None

        if os.path.exists(self.model_data_path):
            with open(self.model_data_path, 'r') as f:
                self.all_model_data = json.load(f)
                if self.all_model_data:
                    self.current_model_data = self.all_model_data[0]
        
    def load_model(self, model_data: dict):
        print(f"Loading model {model_data}...")
        self.current_model_data = model_data
        model_directory = os.path.join(self.current_module_directory, "Models")
        model_filename = model_data.get("fileName")
        model_path = os.path.join(model_directory, model_filename)

        if not os.path.exists(model_path):
            print(f"Model {model_filename} not found. Please press download to download the model.")
            return
        else:
            if self.llm:
                del self.llm
            if model_data.get("type") == "text":
                self.llm = TextLLM(model_path=model_path, n_ctx=4096, n_gpu_layers=-1, seed=-1)
            elif model_data.get("type") == "vision":
                self.llm = VisionLLM(model_path=model_path, mmproj_path=model_data.get("mmproj_path"), n_ctx = 4096, n_gpu_layers=-1, seed=-1)

            print(f"Model changed to {model_filename}.")

    def unload_model(self):
        if self.llm:
            del self.llm
            self.llm = None
            print("Model unloaded.")

    def get_completion(self, text, history, system_prompt, screenshot=False):
        self.load_model(self.current_model_data)
        if not self.llm:
            print("error: Model not loaded")
            return

        response = None
        if isinstance(self.llm, VisionLLM):
            self.llm: VisionLLM
            response = self.llm.get_chat_completion(text, history, system_prompt, screenshot)
        elif isinstance(self.llm, TextLLM):
            self.llm: TextLLM
            response = self.llm.get_chat_completion(text, history, system_prompt)
        self.unload_model()
        return response