import Chatbox from "@/components/chatbox"
import AIModelSelector from "@/components/selector-modal"
import { SidePanel } from "@/components/side-panel"
import { ScrollArea } from "@/components/ui/scroll-area"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    
    return (
        <>
            <div className="relative h-screen w-full overflow-hidden">
                <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pt-4">
                    <Chatbox/>
                </ScrollArea>
                <SidePanel>
                    <div className="space-y-2 flex flex-col items-start">
                        <label className="text-sm font-medium">Logic Module Selector</label>
                        <AIModelSelector />
                    </div>
                </SidePanel>
            </div>
        </>
    )
}

export default LLMPage