import os
from qdrant_client import QdrantClient
import time
from ..lib.LAV_logger import logger

class Memory:
    COLLECTION_NAME = "memory_collection"
    def __init__(self, temp = False):
        self.current_module_directory = os.path.dirname(__file__)
        self.data_path = os.path.join(self.current_module_directory, "data")
        if temp:
            self.client = QdrantClient(":memory:")
        else:
            self.client = QdrantClient(path=self.data_path)
        
        self.client.set_model("sentence-transformers/all-MiniLM-L6-v2")

    
    def insert(self, text, speaker = ""):
        docs = [f"{speaker}: {text}"]
        metadata = [
            {"speaker": speaker},
        ]
        ids = [int(time.time_ns())]
        
        response = self.client.add(
            collection_name=self.COLLECTION_NAME,
            documents=docs,
            metadata=metadata,
            ids=ids
        )
        logger.debug(f"Inserted document: {docs} with ids: {ids}")
        return response

    def query(self, text, limit = 3):
        search_result = self.client.query(
            collection_name=self.COLLECTION_NAME,
            query_text = text,
            limit = limit
        )
        logger.debug(f"Search result: {search_result}")
        for s in search_result:
            logger.debug(s.document)

    def get(self, limit = 50, offset = 0):
        return self.client.scroll(self.COLLECTION_NAME,
                           limit=limit, 
                           offset=offset)

if __name__ == "__main__":
    current_module_directory = os.path.dirname(__file__)
    import time
    startTime = time.time()
    memory = Memory(True)
    logger.debug(f"init time: {time.time()-startTime}")
    startTime = time.time()
    
    memory.insert("It's paris.", "xiaohei")
    memory.insert("what's the capital of Canada?", "Aya")
    memory.insert("dogs are better than cats", "Aya")
    memory.insert("I do not like cats", "Aya")
    memory.insert("I have a good amount of money", "Aya")
    memory.insert("What should I buy with all this money?", "Aya")
    memory.insert("cats are the worst", "Aya")
    memory.insert("what's the capital of france?", "Aya")
    memory.query("I need money")
    logger.debug(f"Inference time: {time.time()-startTime}")