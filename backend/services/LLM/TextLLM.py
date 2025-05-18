from services.lib.LAV_logger import logger
import os
from typing import Generator
from llama_cpp import Llama
from .BaseLLM import BaseLLM

class TextLLM(BaseLLM):
    def __init__(self, model_path, n_ctx=4096, n_gpu_layers=-1, seed=-1):
        self.context_length = n_ctx
        self.llm = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            seed=seed,
            verbose=True
        )

    def get_chat_completion(self, text: str, history: list = [], system_prompt: str = "") -> Generator[str, None, None]:
        messages = [
            {"role": "system", "content": system_prompt},
        ]

        if history:
            for entry in history:
                messages.append(entry)

        messages.append({"role": "user", "content": text})

        def count_tokens(msg_list):
            result = sum(len(self.llm.tokenize(
                str.encode(msg['content']))) for msg in msg_list)
            logger.debug(f"Tokens_in_context = {result}")
            return result

        while count_tokens(messages) > self.context_length and len(messages) > 1:
            messages.pop(1)


        completion_chunks = self.llm.create_chat_completion(messages, stream=True, max_tokens=1024, temperature=0.9, repeat_penalty=2.0)
        
        for completion_chunk in completion_chunks:
            if "content" in completion_chunk["choices"][0]["delta"].keys():
                yield completion_chunk["choices"][0]["delta"]["content"]
            else:
                pass

if __name__ == "__main__":
    current_module_directory = os.path.dirname(__file__)
    import time
    startTime = time.time()
    text_LLM = TextLLM(model_path=os.path.join(current_module_directory,"Models", "aya-v0.5-q4_k_m.gguf"))
    logger.debug("init time: ", time.time()-startTime)
    startTime = time.time()
    completion_chunks = text_LLM.get_chat_completion("What do you think of Vtubers?")
    for completion_chunk in completion_chunks:
        print(completion_chunk, end="", flush=True)
    logger.debug("Inference time: ", time.time()-startTime)