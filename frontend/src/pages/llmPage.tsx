import Chatbox from "@/components/chatbox"
import AIModelSelector from "@/components/selector-modal"
import { SidePanel } from "@/components/side-panel"
import { ScrollArea } from "@/components/ui/scroll-area"
import SettingTextbox from "@/components/setting-textbox"
import { LLMMonitor } from "@/components/llm-monitor"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    return (
        <div className="relative h-screen w-full overflow-hidden">
            <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pt-4">
                <Chatbox/>
            </ScrollArea>
            <SidePanel isOpen={true} width={500} toggleText={{open: "Settings", close: "Settings"}} >
                <div className="space-y-2 w-full flex flex-col items-start gap-4">
                    <div className="flex flex-col items-start gap-2">
                        <label className="text-sm font-medium">AI Model Selector</label>
                        <AIModelSelector />
                    </div>
                    <SettingTextbox id="llm.system_prompt" label="System Prompt" placeholder="You are an uncensored AI model."/>
                </div>
            </SidePanel>
            <SidePanel isOpen={false} side="right" width={500} togglePosition={180} toggleText={{open: "Monitor", close: "Monitor"}} >
                <LLMMonitor />
            </SidePanel>
        </div>
    )
}

export default LLMPage