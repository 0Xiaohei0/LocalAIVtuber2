import Chatbox from "@/components/chatbox"
import { ChatSidebar } from "@/components/chat-sidebar"
import { useEffect, useState } from "react"
import { MessageSquareText, ArrowLeftToLine, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateSessionId } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    const [currentSession, setCurrentSession] = useState<SessionInfo>({ id: "", title: "" })
    const [collapsed, setCollapsed] = useState<boolean>(false)
    // const sessions:SessionInfo[] = [{id:"1234", title:"test"},{id:"12354", title:"test2"},{id:"12344", title:"test3"}]
    const [sessionInfoList, setSessionInfoList] = useState<SessionInfo[]>([])

    const updateSessions = async () => {
        let updatedList = await fetch('/api/memory/session').then(res => res.json());
        if (!Array.isArray(updatedList)) updatedList = [];
        setSessionInfoList(updatedList);
    };

    useEffect(() => {
        updateSessions();
    }, []);

    const createSession = async () => {
        const session_id = generateSessionId();
        const title = "New Chat";

        const res = await fetch('/api/memory/session/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id, title }),
        });

        const data = await res.json();
        if (data.session_id) {
            setCurrentSession({ id: session_id, title });

            // Optionally, refresh session list
            updateSessions()
        }
    }

    const deleteSession = async (session_info: SessionInfo) => {
        const res = await fetch('/api/memory/session/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: session_info.id,
            }),
        });

        const data = await res.json();
        if (data.session_id) {
            setCurrentSession({ id: "", title: "" });
            // Optionally, refresh session list
            updateSessions()
        }
    }

    const onChangeTitle = async (session_info: SessionInfo) => {
        try {
            // Call backend to update session title
            const res = await fetch('/api/memory/session/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session_info.id,
                    title: session_info.title,
                }),
            });

            if (!res.ok) {
                console.error("Failed to update session title");
                return;
            }

            // Update local session state
            setSessionInfoList(prev =>
                prev.map(session =>
                    session.id === session_info.id ? { ...session, title: session_info.title } : session
                )
            );

            // // Also update current session if it's the same one
            if (currentSession.id === session_info.id) {
                setCurrentSession(prev => ({ ...prev, title: session_info.title }));
            }
        } catch (err) {
            console.error("Error updating session title:", err);
        }
    }

    return (
        <div>
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
                    {currentSession.title}</div>
                {!collapsed &&
                    <div className="border-t-1">
                        <ChatSidebar onItemClick={setCurrentSession} onChangeTitle={onChangeTitle} sessions={sessionInfoList} onDeleteSession={deleteSession} />
                    </div>}
                <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pt-4">
                    <Chatbox sessionId={currentSession.id} />
                </ScrollArea>
            </div>
        </div>
    )
}

export default LLMPage