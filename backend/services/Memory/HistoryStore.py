import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

class HistoryStore:
    def __init__(self, sessions_dir_name: str = "chat_sessions"):
        """
        Initialize the HistoryStore with a directory for storing chat sessions.
        
        Args:
            sessions_dir (str): Directory where chat session files will be stored
        """
        self.sessions_dir = os.path.join(os.path.dirname(__file__), sessions_dir_name)
        self._ensure_sessions_dir()

    def _ensure_sessions_dir(self) -> None:
        """Create the sessions directory if it doesn't exist."""
        if not os.path.exists(self.sessions_dir):
            os.makedirs(self.sessions_dir)

    def _get_session_path(self, session_id: str) -> str:
        """Get the full path for a session file."""
        return os.path.join(self.sessions_dir, f"{session_id}.json")

    def create_session(self, title: str) -> Dict[str, Any]:
        """
        Create a new chat session.
        
        Args:
            title (str): Title of the chat session
            
        Returns:
            Dict[str, Any]: Session information including id, title, and creation time
        """
        session_id = str(uuid.uuid4())
        session_data = {
            "id": session_id,
            "title": title,
            "created_at": datetime.now().isoformat(),
            "history": []
        }
        
        session_path = self._get_session_path(session_id)
        with open(session_path, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
            
        return session_data

    def update_session(self, session_id: str, history: List[Dict[str, str]]) -> bool:
        """
        Update an existing chat session with new history.
        
        Args:
            session_id (str): ID of the session to update
            history (List[Dict[str, str]]): Complete chat history to store
            
        Returns:
            bool: True if update was successful, False if session doesn't exist
        """
        session_path = self._get_session_path(session_id)
        if not os.path.exists(session_path):
            return False
            
        try:
            with open(session_path, 'r', encoding='utf-8') as f:
                session_data = json.load(f)
            
            session_data["history"] = history
            
            with open(session_path, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
            return True
        except (json.JSONDecodeError, IOError):
            return False

    def update_session_title(self, session_id: str, title: str) -> bool:
        """
        Update the title of an existing chat session.
        
        Args:
            session_id (str): ID of the session to update
            title (str): New title for the session
            
        Returns:
            bool: True if update was successful, False if session doesn't exist
        """
        session_path = self._get_session_path(session_id)
        if not os.path.exists(session_path):
            return False
            
        try:
            with open(session_path, 'r', encoding='utf-8') as f:
                session_data = json.load(f)
            
            session_data["title"] = title
            
            with open(session_path, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
            return True
        except (json.JSONDecodeError, IOError):
            return False

    def get_session_list(self) -> List[Dict[str, Any]]:
        """
        Get a list of all chat sessions with their metadata.
        
        Returns:
            List[Dict[str, Any]]: List of session information (id, title, creation time)
        """
        sessions = []
        for filename in os.listdir(self.sessions_dir):
            if filename.endswith('.json'):
                try:
                    with open(os.path.join(self.sessions_dir, filename), 'r', encoding='utf-8') as f:
                        session_data = json.load(f)
                        # Only include metadata, not the full history
                        sessions.append({
                            "id": session_data["id"],
                            "title": session_data["title"],
                            "created_at": session_data["created_at"]
                        })
                except (json.JSONDecodeError, IOError):
                    continue
        return sorted(sessions, key=lambda x: x["created_at"], reverse=True)

    def get_session_history(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the complete session data including history.
        
        Args:
            session_id (str): ID of the session to retrieve
            
        Returns:
            Optional[Dict[str, Any]]: Complete session data including history, or None if not found
        """
        session_path = self._get_session_path(session_id)
        if not os.path.exists(session_path):
            return None
            
        try:
            with open(session_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

    def delete_session(self, session_id: str) -> bool:
        """
        Delete a chat session.
        
        Args:
            session_id (str): ID of the session to delete
            
        Returns:
            bool: True if deletion was successful, False if session doesn't exist
        """
        session_path = self._get_session_path(session_id)
        if os.path.exists(session_path):
            try:
                os.remove(session_path)
                return True
            except IOError:
                return False
        return False
