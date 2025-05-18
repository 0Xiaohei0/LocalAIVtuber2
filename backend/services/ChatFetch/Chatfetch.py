import pytchat
import asyncio

class ChatFetch:
    def __init__(self):
        self.chat = None
        self.running = False
        self.video_id = ""

    async def start_fetching(self, websocket_clients):
        if self.running:
            print("Terminating the previous chat fetch process.")
            self.stop_fetching()

        self.chat = pytchat.create(video_id=self.video_id)
        self.running = True
        try:
            while self.running and self.chat.is_alive():
                for c in self.chat.get().sync_items():
                    message = {
                        "datetime": c.datetime,
                        "author": c.author.name,
                        "message": c.message
                    }
                    asyncio.create_task(self.broadcast_message(message, websocket_clients))
                await asyncio.sleep(2) 
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