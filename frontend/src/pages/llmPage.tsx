import Chatbox from "@/components/chatbox"
import { ScrollArea } from "@/components/ui/scroll-area"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    return (
        <div className="relative h-screen w-full overflow-hidden">
            <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pt-4">
                    <Chatbox sessionId={"test2"} />
                </ScrollArea>
        </div>
    )
}

export default LLMPage