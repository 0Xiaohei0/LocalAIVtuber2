import os
from typing import Generator
from llama_cpp import Llama

from llama_cpp.llama_chat_format import Llava16ChatHandler
import base64
import pyautogui

from .BaseLLM import BaseLLM

def image_to_base64_data_uri(file_path):
    with open(file_path, "rb") as img_file:
        base64_data = base64.b64encode(img_file.read()).decode('utf-8')
        return f"data:image/png;base64,{base64_data}"

class VisionLLM(BaseLLM):
    def __init__(self, model_path, mmproj_path, n_ctx=4096, n_gpu_layers=-1, seed=-1):
        self.current_module_directory = os.path.dirname(__file__)

        self.screenshot_path = os.path.join(self.current_module_directory, "screen.png")
        self.test_path = os.path.join(self.current_module_directory, "test.png")

        self.chat_handler = Llava16ChatHandler(clip_model_path=mmproj_path, verbose=False)
        self.context_length = n_ctx

        self.llm = Llama(
            model_path=model_path,
            chat_handler=self.chat_handler,
            n_ctx=n_ctx, # n_ctx should be increased to accommodate the image embedding
            n_gpu_layers=n_gpu_layers,
            seed=seed,
            verbose=False
        )

    def get_chat_completion(self, text: str, history: list = [], system_prompt: str = "", screenshot: bool = False) -> Generator[str, None, None]:
        messages = [
            {"role": "system", "content": system_prompt},
        ]

        for entry in history:
            messages.append(entry)

        if screenshot:
            image = pyautogui.screenshot()
            image.save(self.screenshot_path)
            data_uri = image_to_base64_data_uri(self.screenshot_path)

            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_uri }},
                        {"type": "text", "text": text}
                    ]
                }
            )
        else:
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text}
                    ]
                }
            )

        def count_tokens(msg_list):
            result = sum(len(self.llm.tokenize(
                str.encode(msg['content']))) for msg in msg_list)
            print(f"Tokens_in_context = {result}")
            return result

        # Trim oldest messages if context length in tokens is exceeded
        while count_tokens(messages) > self.context_length and len(messages) > 1:
            # Remove the oldest message (after the system prompt)
            messages.pop(1)

        completion_chunks = self.llm.create_chat_completion(
            messages=messages,
            stream=True
        )

        for completion_chunk in completion_chunks:
            if "content" in completion_chunk["choices"][0]["delta"].keys():
                yield completion_chunk["choices"][0]["delta"]["content"]
            else:
                pass

    
if __name__ == "__main__":
    import time
    startTime = time.time()

    current_module_directory = os.path.dirname(__file__)

    vision_llm = VisionLLM(os.path.join(current_module_directory,"Models", "llava-v1.6-mistral-7b.Q4_K_M.gguf"),
                            os.path.join(current_module_directory,"Models", "mmproj-model-f161.6.gguf"))
    
    print("init time: ", time.time()-startTime)
    startTime = time.time()
    completion_chunks = vision_llm.get_chat_completion("What do you think of this image, use sarcasm and provide entertaining insight, don't simply describe the image.", screenshot=True)
    for completion_chunk in completion_chunks:
        print(completion_chunk, end="", flush=True)
    print("Inference time: ", time.time()-startTime)