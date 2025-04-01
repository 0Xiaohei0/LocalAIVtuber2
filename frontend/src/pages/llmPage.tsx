import Chatbox from "@/components/chatbox"
import { ChatSidebar } from "@/components/chat-sidebar"
import { useEffect, useState } from "react"
import { MessageSquareText, ArrowLeftToLine, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateSessionId } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidePanel } from "@/components/side-panel"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    const [currentSession, setCurrentSession] = useState<SessionInfo>({ id: "", title: "" })
    const [collapsed, setCollapsed] = useState<boolean>(false)
    // const sessions:SessionInfo[] = [{id:"1234", title:"test"},{id:"12354", title:"test2"},{id:"12344", title:"test3"}]
    const [sessionInfoList, setSessionInfoList] = useState<SessionInfo[]>([])
    const [keepLLMLoaded, setKeepLLMLoaded] = useState(false)


    useEffect(() => {
        updateSessions();
    }, []);

    const toggleKeepLLMLoaded = async () => {
        try {
            const response = await fetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        llm: {
                            keep_model_loaded: !keepLLMLoaded
                        }
                    }
                }),
            });

            const data = await response.json();
            if (response.ok) {
                console.log("Settings updated successfully:", data.message);
                setKeepLLMLoaded((prev) => (!prev))
            } else {
                console.error("Failed to update settings:", data.error);
            }
        } catch (error) {
            console.error("Error updating settings:", error);
        }
    };

    const updateSessions = async () => {
        try {
            const res = await fetch('/api/memory/session');
            const data = await res.json();

            if (!res.ok) {
                console.error("Error fetching sessions:", data?.error);
                setSessionInfoList([]);
                return;
            }

            if (!Array.isArray(data)) {
                console.error("Unexpected response format:", data);
                setSessionInfoList([]);
                return;
            }

            setSessionInfoList(data);
        } catch (error) {
            console.error("Fetch error:", error);
            setSessionInfoList([]);
        }
    };

    const createSession = async () => {
        const session_id = generateSessionId();
        const title = "New Chat";

        try {
            const res = await fetch('/api/memory/session/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id, title }),
            });

            const data = await res.json();
            if (!res.ok) {
                console.error("Error creating session:", data?.error);
                return;
            }

            setCurrentSession({ id: session_id, title });

            // Optionally, refresh session list
            updateSessions();
        } catch (error) {
            console.error("Fetch error:", error);
        }
    };

    const deleteSession = async (session_info: SessionInfo) => {
        try {
            const res = await fetch('/api/memory/session/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session_info.id,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                console.error("Error deleting session:", data?.error);
                return;
            }

            setCurrentSession({ id: "", title: "" });

            // Optionally, refresh session list
            updateSessions();
        } catch (error) {
            console.error("Fetch error:", error);
        }
    };

    const onChangeTitle = async (session_info: SessionInfo) => {
        try {
            const res = await fetch('/api/memory/session/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session_info.id,
                    title: session_info.title,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                console.error("Error updating session title:", data?.error);
                return;
            }

            // Update local session state
            setSessionInfoList(prev =>
                prev.map(session =>
                    session.id === session_info.id ? { ...session, title: session_info.title } : session
                )
            );

            // Also update current session if it's the same one
            if (currentSession.id === session_info.id) {
                setCurrentSession(prev => ({ ...prev, title: session_info.title }));
            }
        } catch (error) {
            console.error("Fetch error:", error);
        }
    }

    return (
        <div className="relative h-screen overflow-hidden">
            <div className="grid h-screen"
                style={{
                    gridTemplateColumns: collapsed ? '1fr' : '200px 1fr',
                    gridTemplateRows: '50px 1fr',
                }}>
                {!collapsed && <div className=" border-t-1 flex gap-2 items-center p-2">
                    <Button variant="outline" onClick={() => setCollapsed(!collapsed)}><ArrowLeftToLine></ArrowLeftToLine></Button>
                    <Button variant="outline" onClick={() => createSession()}><Plus></Plus></Button>
                </div>}
                <div className="border-t-1 border-l-1 flex items-center p-2 gap-2">
                    {collapsed &&
                        <>
                            <Button variant="outline" onClick={() => setCollapsed(!collapsed)}>
                                <MessageSquareText></MessageSquareText>
                            </Button>
                            <Button variant="outline" onClick={() => createSession()}><Plus></Plus></Button>
                        </>
                    }
                    {currentSession.title + ' (' + currentSession.id + ')'}</div>
                {!collapsed &&
                    <div className="border-t-1">
                        <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pt-4">
                            <ChatSidebar onItemClick={setCurrentSession} onChangeTitle={onChangeTitle} sessions={sessionInfoList} onDeleteSession={deleteSession} />
                        </ScrollArea>
                    </div>}
                <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pt-4">
                    <Chatbox sessionId={currentSession.id} onCreateSession={createSession} />
                </ScrollArea>
                <SidePanel className="">
                    <div className="flex justify-center items-center space-x-2">
                        <Switch onClick={toggleKeepLLMLoaded} />
                        <Label>{"Keep LLM loaded"}</Label>
                    </div>
                </SidePanel>
            </div>
        </div>
    )
}

export default LLMPage