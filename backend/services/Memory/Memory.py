import json
import os
import re
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
import time
from ..lib.LAV_logger import logger
import datetime

class Memory:
    MESSAGE_COLLECTION_NAME = "memory_collection"
    SESSION_COLLECTION_NAME = "session_collection"
    def __init__(self, temp = False):
        self.current_module_directory = os.path.dirname(__file__)
        self.data_path = os.path.join(self.current_module_directory, "data")
        if temp:
            self.client = QdrantClient(":memory:")
        else:
            self.client = QdrantClient(path=self.data_path)
        
        self.client.set_model("sentence-transformers/all-MiniLM-L6-v2")

    
    def insert_message(self, message:str, role="", name="", session_id=""):
        time_str = '{:%Y-%m-%d %H:%M:%S.%f}'.format(datetime.datetime.now())
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
            collection_name=self.MESSAGE_COLLECTION_NAME,
            documents=docs,
            metadata=metadata,
            ids=ids
        )
        logger.debug(f"Inserted document: {docs} with metadata: {metadata}")
        return response

    def query(self, text, limit = 3)  -> list:
        if not self.collection_exists(): return []
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
        if not self.collection_exists(): return
        self.collection_exists(self.MESSAGE_COLLECTION_NAME)
        return self.client.scroll(self.MESSAGE_COLLECTION_NAME,
                           limit=limit, 
                           offset=offset)[0]
    

    def upsert_session(self, session_id: str, title: str):
        time_str = '{:%Y-%m-%d %H:%M:%S.%f}'.format(datetime.datetime.now())
        title_point = [f"[{time_str}][session-title]: {title}"]
        metadata = [{
            "session_id": session_id,
            "time": time_str,
            "title": title
        }]
        filter_obj = Filter(
                must=[
                    FieldCondition(
                        key="session_id",
                        match=MatchValue(value=session_id)
                    )
                ]
            )
        existing_points = None
        if self.client.collection_exists(self.SESSION_COLLECTION_NAME):
            # Step 1: Try to find existing point with this session_id
            existing_points = self.client.scroll(
                collection_name=self.SESSION_COLLECTION_NAME,
                scroll_filter=filter_obj,
                limit=1
            )

        if existing_points and existing_points[0]:
            existing_id = existing_points[0][0].id  # First point ID
            ids = [existing_id]
            logger.debug(f"Updating existing session with ID: {existing_id}")
        else:
            # No match found, insert new with a fresh UUID
            ids = [str(uuid.uuid4())]
            logger.debug(f"Inserting new session with session_id: {session_id}")

        # Step 2: Add (insert or overwrite)
        response = self.client.add(
            collection_name=self.SESSION_COLLECTION_NAME,
            documents=title_point,
            metadata=metadata,
            ids=ids
        )

        logger.debug(f"Upserted session title: {title_point} with metadata: {metadata}")
        return response
    
    
    def get_sessions(self, limit=100) -> list:
        if not self.client.collection_exists(self.SESSION_COLLECTION_NAME): return []
        all_sessions = []
        offset = None

        while True:
            result, offset = self.client.scroll(
                collection_name=self.SESSION_COLLECTION_NAME,
                limit=500,
                offset=offset,
                with_payload=True
            )
            all_sessions.extend(result)
            if offset is None:
                break

        # Convert and sort
        session_data = []
        for point in all_sessions:
            metadata = point.payload
            if not metadata:
                continue
            time_str = metadata.get("time")
            session_id = metadata.get("session_id")
            title = metadata.get("title", "Untitled")

            if not time_str or not session_id:
                continue

            try:
                timestamp = datetime.datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S.%f")
            except:
                continue

            session_data.append({
                "id": session_id,
                "title": title,
                "timestamp": timestamp
            })

        # Sort by time desc and return top N
        sorted_sessions = sorted(session_data, key=lambda x: x["timestamp"], reverse=True)
        return sorted_sessions[:limit]

    def get_messages_by_session(self, session_id: str, limit: int = 1000) -> list:
        if not self.collection_exists(): return []
        try:
            filter_obj = Filter(
                must=[
                    FieldCondition(
                        key="session_id",
                        match=MatchValue(value=session_id)
                    )
                ]
            )

            results = self.client.scroll(
                collection_name=self.MESSAGE_COLLECTION_NAME,
                scroll_filter=filter_obj,
                limit=limit,
                with_payload=True
            )[0]
        except Exception as e:
            logger.error(f"Error retrieving messages for session {session_id}: {e}", exc_info=True)
            return []

        messages = []
        for point in results:
            payload = point.payload or point.metadata
            messages.append({
                "role": payload.get("role", ""),
                "name": payload.get("name", ""),
                "message": payload.get("message", ""),
                "timestamp": payload.get("time", "")
            })

        messages.sort(key=lambda x: x["timestamp"])
        return messages

    def delete_session(self, session_id: str):
        if not self.collection_exists(): return
        filter_obj = Filter(
                must=[
                    FieldCondition(
                        key="session_id",
                        match=MatchValue(value=session_id)
                    )
                ]
            )

        self.client.delete(
            collection_name=self.SESSION_COLLECTION_NAME,
            points_selector=filter_obj
        )

        self.client.delete(
            collection_name=self.MESSAGE_COLLECTION_NAME,
            points_selector=filter_obj
        )

        return {
            "status": "deleted",
            "session_id": session_id,
        }

    def collection_exists(self):
        return self.client.collection_exists(self.MESSAGE_COLLECTION_NAME) and self.client.collection_exists(self.SESSION_COLLECTION_NAME)


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