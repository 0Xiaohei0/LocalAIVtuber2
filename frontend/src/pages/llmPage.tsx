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
    const [sessionInfo, setSessionInfo] = useState<SessionInfo[]>([])

    const updateSessions = async () => {
        const updatedList = await fetch('/api/memory/session').then(res => res.json());
        console.log("session list: " + updatedList)
        setSessionInfo(updatedList);
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

    return (
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
                    <ChatSidebar onItemClick={setCurrentSession} sessions={sessionInfo} />
                </div>}
            <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pt-4">
                <Chatbox sessionId={currentSession.id}/>
            </ScrollArea>
        </div>

    )
}

export default LLMPage