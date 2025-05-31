import json
import os
import shutil
from services.lib.LAV_logger import logger

from .BaseLLM import BaseLLM
from .TextLLM import TextLLM
from .VisionLLM import VisionLLM


class LLM:
    def __init__(self, gpu_layers=-1):
        self.current_module_directory = os.path.dirname(__file__)
        self.models_directory = os.path.join(self.current_module_directory, "Models")
        self.current_model_data = None
        self.llm: BaseLLM | None = None
        self.all_model_data = None
        self.keep_model_loaded = False

        # Initialize models directory if it doesn't exist
        if not os.path.exists(self.models_directory):
            os.makedirs(self.models_directory)

        # Load available models
        self._load_available_models()
        
        if self.keep_model_loaded and self.current_model_data:
            self.load_model(self.current_model_data, gpu_layers)

    def _load_available_models(self):
        """Load all available models from their respective folders"""
        self.all_model_data = []
        for model_folder in os.listdir(self.models_directory):
            model_path = os.path.join(self.models_directory, model_folder)
            if os.path.isdir(model_path):
                metadata_path = os.path.join(model_path, "metadata.json")
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r') as f:
                        model_data = json.load(f)
                        self.all_model_data.append(model_data)
                        if not self.current_model_data:
                            self.current_model_data = model_data

    def _migrate_old_structure(self):
        """Migrate from old structure to new folder-based structure"""
        old_model_data_path = os.path.join(self.current_module_directory, "model_data.json")
        if not os.path.exists(old_model_data_path):
            return

        with open(old_model_data_path, 'r') as f:
            old_model_data = json.load(f)

        for model_data in old_model_data:
            model_name = model_data["fileName"]
            model_folder = os.path.join(self.models_directory, os.path.splitext(model_name)[0])
            
            # Create model folder if it doesn't exist
            if not os.path.exists(model_folder):
                os.makedirs(model_folder)

            # Move model file to its folder
            old_model_path = os.path.join(self.models_directory, model_name)
            new_model_path = os.path.join(model_folder, model_name)
            if os.path.exists(old_model_path) and not os.path.exists(new_model_path):
                shutil.move(old_model_path, new_model_path)

            # Create metadata.json in model folder
            metadata_path = os.path.join(model_folder, "metadata.json")
            if not os.path.exists(metadata_path):
                with open(metadata_path, 'w') as f:
                    json.dump(model_data, f, indent=4)

        # Remove old model_data.json
        os.remove(old_model_data_path)

    def load_model_by_name(self, model_name: str, gpu_layers=-1):
        """Load a model by its name"""
        self._load_available_models()
        for model_data in self.all_model_data:
            if model_data.get("fileName") == model_name:
                self.load_model(model_data, gpu_layers)
                return True
        logger.error(f"Model {model_name} not found.")
        return False
        
    def load_model(self, model_data: dict, gpu_layers=-1):
        """Load a model using its metadata"""
        logger.info(f"Loading model {model_data}...")
        if (self.llm and self.current_model_data.get('fileName') == model_data.get('fileName')):
            logger.info(f"Same model already loaded, load cancelled...")
            return

        self.current_model_data = model_data
        model_name = model_data.get("fileName")
        model_folder = os.path.join(self.models_directory, os.path.splitext(model_name)[0])
        model_path = os.path.join(model_folder, model_name)

        if not os.path.exists(model_path):
            logger.error(f"Model {model_name} not found. Please press download to download the model.")
            return
        else:
            self.unload_model()
            if model_data.get("type") == "text":
                self.llm = TextLLM(model_path=model_path, n_ctx=4096, n_gpu_layers=gpu_layers, seed=-1)
            elif model_data.get("type") == "vision":
                mmproj_path = os.path.join(model_folder, model_data.get("mmproj_path"))
                self.llm = VisionLLM(model_path=model_path, mmproj_path=mmproj_path, n_ctx=4096, n_gpu_layers=gpu_layers, seed=-1)

            logger.info(f"Model changed to {model_name}.")

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