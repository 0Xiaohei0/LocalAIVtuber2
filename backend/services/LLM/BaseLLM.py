from abc import ABC, abstractmethod

class BaseLLM(ABC):
    @abstractmethod
    def get_chat_completion(self, text, history, system_prompt):
        pass