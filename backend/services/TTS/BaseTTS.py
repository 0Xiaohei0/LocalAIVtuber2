from abc import ABC, abstractmethod

class BaseTTS(ABC):
    @abstractmethod
    def synthesize(self, text):
        pass