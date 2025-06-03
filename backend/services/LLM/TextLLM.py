from services.lib.LAV_logger import logger
import os
from typing import Generator, Optional, Dict, List, Union
from llama_cpp import Llama
from .BaseLLM import BaseLLM
from datetime import datetime
from jinja2 import Environment
import llama_cpp.llama_chat_format as llama_chat_format
import json
class TextLLM(BaseLLM):
    def __init__(self, model_path, n_ctx=4096, n_gpu_layers=-1, seed=-1):
        self.context_length = n_ctx
        self.chat_format = "chatml"

        # Create Jinja2 environment with strftime_now function
        env = Environment()
        env.globals['strftime_now'] = lambda fmt: datetime.now().strftime(fmt)
        
        self.llm = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            seed=seed,
            verbose=True,
            chat_format=self.chat_format,
            chat_handler=None,
            chat_template=None,
            jinja2_env=env
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

        completion_chunks = self.llm.create_chat_completion(messages, stream=True, max_tokens=1024, temperature=0.9, repeat_penalty=1.1)
        
        for completion_chunk in completion_chunks:
            if "content" in completion_chunk["choices"][0]["delta"].keys():
                yield completion_chunk["choices"][0]["delta"]["content"]
            else:
                pass

    def complete_current_response(self, history: List[Dict[str, str]], system_prompt: str = "") -> Generator[str, None, None]:
        """
        Complete the current response in the conversation by continuing token prediction
        from the current context until an end token is reached.
        
        Args:
            history: List of message dictionaries containing the conversation history
            system_prompt: Optional system prompt to guide the completion
            
        Yields:
            str: The completed response chunks
        """
        if not history:
            logger.warning("No history provided to complete")
            return

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)

        def count_tokens(msg_list):
            result = sum(len(self.llm.tokenize(
                str.encode(msg['content']))) for msg in msg_list)
            logger.debug(f"Tokens_in_context = {result}")
            return result

        while count_tokens(messages) > self.context_length and len(messages) > 1:
            messages.pop(1)

        # apply chatml format to the messages
        logger.debug(f"Messages: {messages}")
        
        # Format messages according to ChatML format
        prompt = ""
        for idx, msg in enumerate(messages):
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                prompt += f"<|im_start|>system\n{content}"
            elif role == "user":
                prompt += f"<|im_start|>user\n{content}"
            elif role == "assistant":
                prompt += f"<|im_start|>assistant\n{content}"

            if idx != len(messages) - 1:
                prompt += "<|im_end|>\n"

        # Define stop tokens to prevent the model from continuing beyond the response
        stop = ["<|im_end|>", "<|im_start|>"]
        
        logger.debug(f"Prompt: {prompt}")
        logger.debug(f"Stop: {stop}")

        completion_chunks = self.llm.create_completion(
            prompt, 
            stream=True, 
            max_tokens=2048,  # Increased to allow for longer completions
            temperature=0.9, 
            repeat_penalty=1.1,
            stop=stop
        )

        
        for completion_chunk in completion_chunks:
            yield completion_chunk["choices"][0]["text"]
        else:
            pass

if __name__ == "__main__":
    current_module_directory = os.path.dirname(__file__)
    import time
    startTime = time.time()
    text_LLM = TextLLM(model_path=os.path.join(current_module_directory,"Models", "dolphin-2.6-mistral-7b.Q4_0", "dolphin-2.6-mistral-7b.Q4_0.gguf"))
    logger.debug(f"init time: {time.time()-startTime}")
    startTime = time.time()
    completion_chunks = text_LLM.get_chat_completion("What do you think of Vtubers?")
    for completion_chunk in completion_chunks:
        print(completion_chunk, end="", flush=True)
    logger.debug(f"Inference time: {time.time()-startTime}")
    startTime = time.time()
    completion_chunks = text_LLM.complete_current_response([{"role": "user", "content": "What do you think of Vtubers?"},
                                                          {"role": "assistant", "content": "I think Vtubers"}])
    for completion_chunk in completion_chunks:
        print(completion_chunk, end="", flush=True)
    logger.debug(f"Inference time: {time.time()-startTime}")
