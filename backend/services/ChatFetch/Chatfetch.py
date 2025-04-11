import pytchat
import asyncio

class ChatFetch:
    def __init__(self):
        self.chat = None
        self.running = False

    async def start_fetching(self, video_id, websocket_clients):
        self.chat = pytchat.create(video_id=video_id)
        self.running = True
        try:
            while self.running and self.chat.is_alive():
                for c in self.chat.get().sync_items():
                    message = {
                        "datetime": c.datetime,
                        "author": c.author.name,
                        "message": c.message
                    }
                    # Broadcast the message to all connected WebSocket clients
                    await self.broadcast_message(message, websocket_clients)
                await asyncio.sleep(1)  # Avoid busy-waiting
        except Exception as e:
            print(f"Error in ChatFetch: {e}")
        finally:
            self.running = False

    def stop_fetching(self):
        self.running = False
        if self.chat:
            self.chat.terminate()

    async def broadcast_message(self, message, websocket_clients):
        for websocket in list(websocket_clients):
            try:
                await websocket.send_json(message)
            except Exception:
                websocket_clients.remove(websocket)