import json
import os
import re
import uuid
from qdrant_client import QdrantClient
import time
from ..lib.LAV_logger import logger
import datetime

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

    
    def insert(self, message:str, role="", name="", session_id=""):
        time_str = '{:%Y-%m-%d %H:%M}'.format(datetime.datetime.now())
        # match = re.match(r"\[(.*?)\]\[(.*?)\]: (.*)", text)
        docs = [f"[{time_str}][{role}:{name}]: {message}"]
        metadata = [
            {
                "session_id": session_id,
                "time": time_str,
                "role": role,
                "name": name,
                "message": message
            }
        ]
        ids = [str(uuid.uuid4())]
        
        response = self.client.add(
            collection_name=self.COLLECTION_NAME,
            documents=docs,
            metadata=metadata,
            ids=ids
        )
        logger.debug(f"Inserted document: {docs} with metadata: {metadata}")
        return response

    def query(self, text, limit = 3):
        search_result = self.client.query(
            collection_name=self.COLLECTION_NAME,
            query_text = text,
            limit = limit
        )
        # logger.debug(f"Search result: {search_result}")
        result = []
        for s in search_result:
            result.append(s.metadata)
        return result

    def get(self, limit = 50, offset = 0):
        return self.client.scroll(self.COLLECTION_NAME,
                           limit=limit, 
                           offset=offset)[0]

if __name__ == "__main__":
    current_module_directory = os.path.dirname(__file__)
    import time
    startTime = time.time()
    memory = Memory(temp=True)
    logger.debug(f"init time: {time.time()-startTime}")
    startTime = time.time()
    
    memory.insert("It's paris.","assistant","Aya")
    memory.insert("what's the capital of Canada?","user","Xiaohei")
    memory.insert("dogs are better than cats","assistant","Aya")
    memory.insert("I do not like cats","assistant","Aya")
    memory.insert("I have a good amount of money","assistant","Aya")
    memory.insert("What should I buy with all this money?","assistant","Aya")
    memory.insert("cats are the worst","assistant","Aya")
    memory.insert("what's the capital of france?","assistant","Aya")
    result = memory.query("I need money",limit=1)
    logger.info(f"result metadata: {result}")
    logger.debug(f"Inference time: {time.time()-startTime}")