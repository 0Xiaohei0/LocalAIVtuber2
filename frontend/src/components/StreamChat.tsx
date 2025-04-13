import { useState, useEffect } from "react";
import { Panel } from "./panel";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useSettings } from "@/context/SettingsContext";
import { StreamChatManager } from "@/lib/streamChatManager";

export function StreamChat() {
    const { settings, updateSetting } = useSettings();
    const videoId: string = settings["stream.yt.videoid"] || "";
    const [messages, setMessages] = useState<string[]>([]);
    const [streamChatAPI, setStreamChatAPI] = useState<StreamChatManager | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        const api = new StreamChatManager((message) => {
            setMessages((prev) => [...prev, message]);
        });
        setStreamChatAPI(api);

        return () => {
            api.closeSocket();
        };
    }, [videoId]);

    const startChatFetch = async () => {
        if (streamChatAPI) {
            await streamChatAPI.startChatFetch();
            setIsFetching(streamChatAPI.isChatFetching());
        }
    };

    const stopChatFetch = async () => {
        if (streamChatAPI) {
            await streamChatAPI.stopChatFetch();
            setIsFetching(streamChatAPI.isChatFetching());
        }
    };

    const handleChangeVideoId = async (id: string) => {
        await updateSetting("stream.yt.videoid", id);
    };

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
                <Button
                    className="max-w-1/2"
                    variant={`${isFetching ? "destructive" : "outline"}`}
                    onClick={isFetching ? stopChatFetch : startChatFetch}
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