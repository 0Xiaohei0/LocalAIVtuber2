from typing import List, Dict, Any, Optional
from ..lib.LAV_logger import logger


class ChatChunker:
    """
    A class for chunking chat history using a sliding window approach.
    
    This class takes chat history and creates overlapping chunks of messages
    that can be stored in a vector database for retrieval-augmented generation.
    """
    
    def __init__(self, window_size: int = 3, stride: int = 1):
        """
        Initialize the ChatChunker.
        
        Args:
            window_size: Number of messages to include in each chunk
            stride: Number of messages to move forward for each new chunk
        """
        self.window_size = window_size
        self.stride = stride
        
    def create_sliding_windows(self, history: List[Dict[str, str]]) -> List[List[Dict[str, str]]]:
        """
        Create sliding windows from chat history.
        
        Args:
            history: List of message dictionaries with 'role' and 'content' keys
            
        Returns:
            List of message windows, where each window is a list of messages
        """
        if len(history) < self.window_size:
            # If history is shorter than window size, return the entire history as one chunk
            return [history] if history else []
            
        windows = []
        for i in range(0, len(history) - self.window_size + 1, self.stride):
            window = history[i:i + self.window_size]
            windows.append(window)
            
        return windows
    
    def format_window_as_text(self, window: List[Dict[str, str]], 
                            format_style: str = "simple") -> str:
        """
        Format a window of messages as a single text string.
        
        Args:
            window: List of message dictionaries
            format_style: How to format the messages ("simple", "detailed", "markdown")
            
        Returns:
            Formatted text string
        """
        if not window:
            return ""
            
        if format_style == "simple":
            return self._format_simple(window)
        elif format_style == "detailed":
            return self._format_detailed(window)
        elif format_style == "markdown":
            return self._format_markdown(window)
        else:
            return self._format_simple(window)
    
    def _format_simple(self, window: List[Dict[str, str]]) -> str:
        """Format messages as simple role: content pairs."""
        formatted_parts = []
        for message in window:
            role = message.get('role', 'unknown')
            content = message.get('content', '')
            formatted_parts.append(f"{role}: {content}")
        return "\n".join(formatted_parts)
    
    def _format_detailed(self, window: List[Dict[str, str]]) -> str:
        """Format messages with more detailed structure."""
        formatted_parts = []
        for i, message in enumerate(window):
            role = message.get('role', 'unknown')
            content = message.get('content', '')
            formatted_parts.append(f"Message {i+1} - {role.upper()}: {content}")
        return "\n\n".join(formatted_parts)
    
    def _format_markdown(self, window: List[Dict[str, str]]) -> str:
        """Format messages using markdown syntax."""
        formatted_parts = []
        for message in window:
            role = message.get('role', 'unknown')
            content = message.get('content', '')
            if role == 'user':
                formatted_parts.append(f"**User:** {content}")
            elif role == 'assistant':
                formatted_parts.append(f"**Assistant:** {content}")
            else:
                formatted_parts.append(f"**{role.title()}:** {content}")
        return "\n\n".join(formatted_parts)
    
    def chunk_history(self, history: List[Dict[str, str]], 
                     session_id: str = "",
                     format_style: str = "simple",
                     include_metadata: bool = True) -> List[Dict[str, Any]]:
        """
        Create chunks from chat history ready for insertion into memory.
        
        Args:
            history: List of message dictionaries with 'role' and 'content' keys
            session_id: Session identifier for the chunks
            format_style: How to format the messages
            include_metadata: Whether to include additional metadata
            
        Returns:
            List of chunk dictionaries with 'text' and optional 'metadata' keys
        """
        windows = self.create_sliding_windows(history)
        chunks = []
        
        for i, window in enumerate(windows):
            chunk_text = self.format_window_as_text(window, format_style)
            
            chunk_data = {
                "text": chunk_text
            }
            
            if include_metadata:
                chunk_data["metadata"] = {
                    "window_index": i,
                    "window_size": len(window),
                    "message_count": len(window),
                    "first_message_role": window[0].get('role') if window else None,
                    "last_message_role": window[-1].get('role') if window else None,
                    "format_style": format_style
                }
            
            chunks.append(chunk_data)
            
        logger.debug(f"Created {len(chunks)} chunks from {len(history)} messages")
        return chunks


def create_chat_chunks(history: List[Dict[str, str]], 
                      window_size: int = 3, 
                      stride: int = 1,
                      session_id: str = "",
                      format_style: str = "simple") -> List[Dict[str, Any]]:
    """
    Convenience function to create chat chunks.
    
    Args:
        history: List of message dictionaries
        window_size: Number of messages per chunk
        stride: Number of messages to move forward
        session_id: Session identifier
        format_style: How to format the messages
        
    Returns:
        List of chunk dictionaries
    """
    chunker = ChatChunker(window_size=window_size, stride=stride)
    return chunker.chunk_history(history, session_id, format_style)


# Example usage and testing
if __name__ == "__main__":
    # Example chat history
    sample_history = [
        {"role": "user", "content": "Hello, how are you?"},
        {"role": "assistant", "content": "I'm doing well, thank you for asking! How can I help you today?"},
        {"role": "user", "content": "Can you tell me about Python?"},
        {"role": "assistant", "content": "Python is a high-level programming language known for its simplicity and readability."},
        {"role": "user", "content": "What are its main features?"},
        {"role": "assistant", "content": "Python's main features include dynamic typing, automatic memory management, and extensive standard libraries."}
    ]
    
    # Create chunker with window size 3 and stride 1
    chunker = ChatChunker(window_size=3, stride=1)
    
    # Create chunks
    chunks = chunker.chunk_history(sample_history, session_id="test-session")
    
    print("Created chunks:")
    for i, chunk in enumerate(chunks):
        print(f"\nChunk {i+1}:")
        print(f"Text: {chunk['text']}")
        if 'metadata' in chunk:
            print(f"Metadata: {chunk['metadata']}")
        print("-" * 50) 