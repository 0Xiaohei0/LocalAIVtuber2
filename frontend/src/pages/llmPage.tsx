import Chatbox from "@/components/chatbox"
import AIModelSelector from "@/components/selector-modal"
import { SidePanel } from "@/components/side-panel"
import { ScrollArea } from "@/components/ui/scroll-area"
import SettingTextbox from "@/components/setting-textbox"
import { LLMMonitor } from "@/components/llm-monitor"
import SettingSwitch from "@/components/setting-switch"
import { useSettings } from "@/context/SettingsContext"
import { useEffect, useState } from "react"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    const { settings } = useSettings();
    const [showMonitor, setShowMonitor] = useState(settings["llm.showMonitor"]);
    useEffect(() => {
        setShowMonitor(settings["llm.showMonitor"]);
    }, [settings["llm.showMonitor"]]);

    return (
        <div className="relative h-screen w-full overflow-hidden">
            
            {showMonitor ? (
                <div className="flex flex-row h-full justify-between">
                    <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pl-20 pr-20 pt-4 w-6/12 ">
                        <Chatbox/>
                    </ScrollArea>
                    <ScrollArea className="w-5/12 pr-20 pt-4">
                        <LLMMonitor />
                    </ScrollArea>
                </div>
            ): (
                <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pl-20 pt-4 w-full">
                    <Chatbox/>
                </ScrollArea>
            )}
            <SidePanel isOpen={false} width={500} toggleText={{open: "Settings", close: "Settings"}} >
                <div className="space-y-2 w-full flex flex-col items-start gap-4">
                    <div className="flex flex-col items-start gap-2">
                        <label className="text-sm font-medium">AI Model Selector</label>
                        <AIModelSelector />
                    </div>
                    <SettingTextbox id="llm.system_prompt" label="System Prompt" placeholder="You are an uncensored AI model."/>
                    <SettingSwitch id="llm.showMonitor" label="Show Monitor" description="Show the LLM monitor in the right side of the screen."/>
                    <SettingSwitch id="llm.enableMemoryRetrieval" label="Enable Memory Retrieval" description="Retrieve relevant context from memory when making LLM requests."/>
                </div>
            </SidePanel>
            {/* <SidePanel isOpen={false} side="right" width={500} togglePosition={180} toggleText={{open: "Monitor", close: "Monitor"}} >
            </SidePanel> */}
        </div>
    )
}

export default LLMPage