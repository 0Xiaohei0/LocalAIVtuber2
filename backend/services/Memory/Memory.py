import json
import os
import re
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, Distance, VectorParams
import time
from ..lib.LAV_logger import logger
import datetime
from typing import List, Dict, Any, Optional
from .ChatChunker import ChatChunker

class Memory:
    MESSAGE_COLLECTION_NAME = "memory_collection"
    
    def __init__(self, temp = False):
        self.current_module_directory = os.path.dirname(__file__)
        self.data_path = os.path.join(self.current_module_directory, "data")
        if temp:
            self.client = QdrantClient(":memory:")
        else:
            self.client = QdrantClient(path=self.data_path)
        
        self.client.set_model("sentence-transformers/all-MiniLM-L6-v2")
    
    def check_collection_exists(self):
        if not self.client.collection_exists(self.MESSAGE_COLLECTION_NAME):
            logger.error(f"Collection {self.MESSAGE_COLLECTION_NAME} does not exist")
            return False
        return True


    def insert_history(self, history: List[Dict[str, str]], session_id: str = "", 
                      window_size: int = 3, stride: int = 1, format_style: str = "simple"):
        """
        Insert chat history into memory by chunking it first.
        
        Args:
            history: List of message dictionaries with 'role' and 'content' keys
            session_id: Session identifier for the chunks
            window_size: Number of messages per chunk
            stride: Number of messages to move forward for each new chunk
            format_style: How to format the messages ("simple", "detailed", "markdown")
        """
        if not history:
            logger.warning("Empty history provided, nothing to insert")
            return None
            
        try:
            # Create chunks from the history
            chunker = ChatChunker(window_size=window_size, stride=stride)
            chunks = chunker.chunk_history(history, session_id, format_style, include_metadata=True)
            
            if not chunks:
                logger.warning("No chunks created from history")
                return None
                
            # Prepare data for insertion
            documents = []
            metadata_list = []
            ids = []
            time_str = '{:%Y-%m-%d %H:%M:%S.%f}'.format(datetime.datetime.now())
            
            for i, chunk in enumerate(chunks):
                # Extract text from chunk
                chunk_text = chunk.get("text", "")
                if not chunk_text.strip():
                    continue
                    
                # Create metadata for this chunk
                chunk_metadata = {
                    "session_id": session_id,
                    "time": time_str,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
                
                # Add chunk-specific metadata if available
                if "metadata" in chunk:
                    chunk_metadata.update(chunk["metadata"])
                
                documents.append(chunk_text)
                metadata_list.append(chunk_metadata)
                ids.append(str(uuid.uuid4()))
            
            if not documents:
                logger.warning("No valid documents to insert after chunking")
                return None
                
            # Insert all chunks into the vector database
            response = self.client.add(
                collection_name=self.MESSAGE_COLLECTION_NAME,
                documents=documents,
                metadata=metadata_list,
                ids=ids
            )
            
            logger.info(f"Inserted {len(documents)} chunks from {len(history)} messages for session {session_id}")
            logger.debug(f"Chunks inserted with metadata: {metadata_list}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error inserting history for session {session_id}: {e}")
            return None

    def query(self, text, limit = 3)  -> list:
        if not self.check_collection_exists(): return []
        search_result = self.client.query(
            collection_name=self.MESSAGE_COLLECTION_NAME,
            query_text = text,
            limit = limit
        )
        # logger.debug(f"Search result: {search_result}")
        result = []
        for s in search_result:
            result.append(s.metadata)
        return result

    def get(self, limit = 50, offset = 0):
        if not self.check_collection_exists(): return None
        return self.client.scroll(self.MESSAGE_COLLECTION_NAME,
                           limit=limit, 
                           offset=offset)[0]

    def query_by_session(self, session_id: str, limit: int = 10) -> List[Dict]:
        """Query memory for messages from a specific session."""
        if not self.check_collection_exists():
            return []
        
        try:
            search_result = self.client.scroll(
                collection_name=self.MESSAGE_COLLECTION_NAME,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="session_id",
                            match=MatchValue(value=session_id)
                        )
                    ]
                ),
                limit=limit
            )[0]
            
            result = []
            for item in search_result:
                doc = ""
                if isinstance(item.payload, dict):
                    doc = item.payload.get("document", "")
                result.append({
                    "text": doc,
                    "metadata": item.payload if isinstance(item.payload, dict) else {}
                })
            return result
        except Exception as e:
            logger.error(f"Error querying session {session_id}: {e}")
            return []

    def delete_session_messages(self, session_id: str) -> bool:
        """Delete all messages from a specific session."""
        if not self.check_collection_exists():
            return False
        
        try:
            # Get all points for the session
            points = self.client.scroll(
                collection_name=self.MESSAGE_COLLECTION_NAME,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="session_id",
                            match=MatchValue(value=session_id)
                        )
                    ]
                ),
                limit=1000  # Adjust as needed
            )[0]
            
            if points:
                point_ids = [point.id for point in points]
                self.client.delete(
                    collection_name=self.MESSAGE_COLLECTION_NAME,
                    points_selector=point_ids
                )
                logger.info(f"Deleted {len(point_ids)} messages for session {session_id}")
            
            return True
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {e}")
            return False

if __name__ == "__main__":
    current_module_directory = os.path.dirname(__file__)
    import time
    startTime = time.time()
    memory = Memory(temp=True)
    logger.debug(f"init time: {time.time()-startTime}")
    startTime = time.time()
    
    memory.insert_message("It's paris.","assistant","Aya")
    memory.insert_message("what's the capital of Canada?","user","Xiaohei")
    memory.insert_message("dogs are better than cats","assistant","Aya")
    memory.insert_message("I do not like cats","assistant","Aya")
    memory.insert_message("I have a good amount of money","assistant","Aya")
    memory.insert_message("What should I buy with all this money?","assistant","Aya")
    memory.insert_message("cats are the worst","assistant","Aya")
    memory.insert_message("what's the capital of france?","assistant","Aya")
    result = memory.query("I need money",limit=1)
    logger.info(f"result metadata: {result}")
    logger.debug(f"Inference time: {time.time()-startTime}")