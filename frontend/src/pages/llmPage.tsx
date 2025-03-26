import Chatbox from "@/components/chatbox"
import { ChatSidebar } from "@/components/chat-sidebar"
import { useState } from "react"
import { MessageSquareText, ArrowLeftToLine } from "lucide-react"
import { Button } from "@/components/ui/button"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    const [currentSession, setCurrentSession] = useState<SessionInfo>({id:"1234", title:"test"})
    const [collapsed, setCollapsed] = useState<boolean>(false)
    const sessions:SessionInfo[] = [{id:"1234", title:"test"},{id:"12354", title:"test2"},{id:"12344", title:"test3"}]

    return (
        <div className="grid h-full"
            style={{
                gridTemplateColumns: collapsed ? '1fr' : '200px 1fr',
                gridTemplateRows: '50px 1fr',
            }}>
            {!collapsed && <div className="border-t-1 flex items-center p-2">
                <Button variant="outline" onClick={() => setCollapsed(!collapsed)}><ArrowLeftToLine></ArrowLeftToLine></Button>
            </div>}
            <div className="border-t-1 border-l-1 flex items-center p-2 gap-2">
                {collapsed && <Button variant="outline" onClick={() => setCollapsed(!collapsed)}>
                    <MessageSquareText></MessageSquareText>
                </Button>}
                {currentSession.title}</div>
            {!collapsed && 
                <div className="border-t-1">
                    <ChatSidebar onItemClick={setCurrentSession} sessions={sessions} />
                </div>}
            <div className="border-t-1 border-l-1 h-full ">
                <Chatbox />
            </div>
        </div>

    )
}

export default LLMPage