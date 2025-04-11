import { useState, useEffect } from "react";
import { Panel } from "./panel";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useSettings } from "@/context/SettingsContext";

export function StreamChat() {
    const { settings, updateSetting } = useSettings();
    const videoId: string = settings["frontend.stream.yt.videoid"] || "";
    const [messages, setMessages] = useState<string[]>([]);
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    const startChatFetch = async () => {
        try {
            const response = await fetch("/api/streamChat/yt/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ video_id: videoId }),
            });

            if (response.ok) {
                const ws = new WebSocket(`ws://${window.location.host}/ws/streamChat`);
                setIsFetching(true)
                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    setMessages((prev) => [...prev, `${message.author}: ${message.message}`]);
                };
                ws.onerror = (error) => console.error("WebSocket error:", error);
                setSocket(ws);
            } else {
                const errorData = await response.json();
                console.error(`Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Failed to start chat fetch:", error);
        }
    };

    const stopChatFetch = async () => {
        try {
            const response = await fetch("/api/streamChat/yt/stop", {
                method: "POST",
            });

            if (response.ok) {
                if (socket) {
                    setIsFetching(false)
                    socket.close();
                    setSocket(null);
                }
            } else {
                console.error("Failed to stop chat fetch.");
            }
        } catch (error) {
            console.error("Failed to stop chat fetch:", error);
        }
    };

    useEffect(() => {
        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [socket]);

    const handleChangeVideoId = async (id:string) => {
        await updateSetting("frontend.stream.yt.videoid", id);
    }

    return (
        <Panel className="flex flex-col gap-4 w-full h-2xl">
            <Label>Stream Chat</Label>
            <div className="flex gap-2">
                <Input
                    type="text"
                    placeholder="Enter Video ID"
                    value={videoId}
                    onChange={(e) => handleChangeVideoId(e.target.value)}
                    className="border p-2 flex-1"
                />
                <Button className=" max-w-1/2"
                    variant={`${isFetching ? "destructive" : "outline"}`}
                    onClick={isFetching ? stopChatFetch: startChatFetch }
                >
                    {isFetching ? "Stop" : "Start"}
          </Button>
            </div>
            <Panel className="border p-4 h-full overflow-y-auto">
                {messages.length > 0 ? (
                    messages.map((msg, index) => (
                        <div key={index} className="mb-2">
                            {msg}
                        </div>
                    ))
                ) : (
                    <div>No messages yet.</div>
                )}
            </Panel>
        </Panel>
    );
}