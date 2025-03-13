from abc import ABC, abstractmethod
from typing import Generator

class BaseLLM(ABC):
    @abstractmethod
    def get_chat_completion(self, text, history, system_prompt) -> Generator[str, None, None]:
        pass