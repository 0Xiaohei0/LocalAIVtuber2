import os
from llama_cpp import Llama

from llama_cpp.llama_chat_format import Llava15ChatHandler
import base64
import pyautogui

def image_to_base64_data_uri(file_path):
    with open(file_path, "rb") as img_file:
        base64_data = base64.b64encode(img_file.read()).decode('utf-8')
        return f"data:image/png;base64,{base64_data}"

class VisionLLM:
    def __init__(self):
        self.current_module_directory = os.path.dirname(__file__)
        self.mmproj_path = os.path.join(self.current_module_directory, "Models","mmproj-model-f16.gguf")
        self.ggml_path = os.path.join(self.current_module_directory, "Models","ggml-model-q4_k.gguf")
        self.screenshot_path = os.path.join(self.current_module_directory, "screen.png")
        self.test_path = os.path.join(self.current_module_directory, "test.png")

        self.chat_handler = Llava15ChatHandler(clip_model_path=self.mmproj_path, verbose=False)

        self.llm = Llama(
            model_path=self.ggml_path,
            chat_handler=self.chat_handler,
            n_ctx=2048, # n_ctx should be increased to accommodate the image embedding
            n_gpu_layers=-1,
            verbose=False
        )

    def get_image_description(self, image_url):
        data_uri = image_to_base64_data_uri(image_url)
        completion_chunks = self.llm.create_chat_completion(
            messages = [
                {"role": "system", "content": "You are an assistant who perfectly describes images."},
                {
                    "role": "user",
                    "content": [
                        # {"type": "image_url", "image_url": {"url": data_uri }},
                        {"type" : "text", "text": "Use English, What are you?"}
                    ]
                }
            ],
            stream=True
        )
        for completion_chunk in completion_chunks:
            if "content" in completion_chunk["choices"][0]["delta"].keys():
                yield completion_chunk["choices"][0]["delta"]["content"]
            else:
                yield ""
    
    def get_screen_description(self):
        screenshot = pyautogui.screenshot()
        screenshot.save(self.screenshot_path)
        return self.get_image_description(self.screenshot_path)
    
if __name__ == "__main__":
    import time
    startTime = time.time()
    vision_llm = VisionLLM()
    print("init time: ", time.time()-startTime)
    startTime = time.time()
    completion_chunks = vision_llm.get_screen_description()
    for completion_chunk in completion_chunks:
        print(completion_chunk, end="", flush=True)
    print("Inference time: ", time.time()-startTime)