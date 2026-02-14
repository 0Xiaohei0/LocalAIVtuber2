import Chatbox from "@/components/chatbox"
import AIModelSelector from "@/components/selector-modal"
import { SidePanel } from "@/components/side-panel"
import { ScrollArea } from "@/components/ui/scroll-area"
import SettingTextbox from "@/components/setting-textbox"
import SettingSlider from "@/components/setting-slider"
import { LLMMonitor } from "@/components/llm-monitor"
import SettingSwitch from "@/components/setting-switch"
import { SciFiCard, SciFiCardHeader, SciFiCardTitle, SciFiCardContent, SciFiCardStatus } from "@/components/ui/SciFiCard"
import { SciFiButton, SciFiCriticalButton } from "@/components/ui/SciFiButton"
import { useSettings } from "@/context/SettingsContext"
import { useEffect, useState } from "react"

export type SessionInfo = {
    title: string,
    id: string
}

function LLMPage() {
    const { settings } = useSettings();
    const [showMonitor, setShowMonitor] = useState(settings["llm.showMonitor"]);
    const [sciFiMode, setSciFiMode] = useState(false);
    
    useEffect(() => {
        setShowMonitor(settings["llm.showMonitor"]);
    }, [settings["llm.showMonitor"]]);

    return (
        <div className={`relative h-screen w-full overflow-hidden ${sciFiMode ? 'bg-gradient-to-br from-black via-slate-900 to-blue-900' : ''}`}>
            
            {/* Sci-Fi Theme Toggle */}
            <div className="absolute top-4 right-4 z-50">
                <SciFiCard variant="scifiGlass" className="p-3">
                    <div className="flex items-center gap-3">
                        <SciFiCardStatus status={sciFiMode ? "online" : "offline"}>
                            {sciFiMode ? "Sci-Fi Mode" : "Standard Mode"}
                        </SciFiCardStatus>
                        <SciFiButton 
                            variant="scifiGhost" 
                            size="sm"
                            onClick={() => setSciFiMode(!sciFiMode)}
                        >
                            ⚡ Toggle
                        </SciFiButton>
                    </div>
                </SciFiCard>
            </div>
            
            {showMonitor ? (
                <div className="flex flex-row h-full justify-between">
                    <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pl-20 pr-20 pt-4 w-6/12 ">
                        {sciFiMode ? (
                            <SciFiCard variant="scifiSolid" animated className="mb-4">
                                <SciFiCardHeader>
                                    <SciFiCardTitle>⚡ NEX-ARIS AI Chat Terminal ⚡</SciFiCardTitle>
                                </SciFiCardHeader>
                                <SciFiCardContent>
                                    <Chatbox/>
                                </SciFiCardContent>
                            </SciFiCard>
                        ) : (
                            <Chatbox/>
                        )}
                    </ScrollArea>
                    <ScrollArea className="w-5/12 pr-20 pt-4">
                        {sciFiMode ? (
                            <SciFiCard variant="scifiNeon" className="mb-4">
                                <SciFiCardHeader>
                                    <SciFiCardTitle>🧠 Neural Network Monitor</SciFiCardTitle>
                                    <SciFiCardStatus status="processing">Active</SciFiCardStatus>
                                </SciFiCardHeader>
                                <SciFiCardContent>
                                    <LLMMonitor />
                                </SciFiCardContent>
                            </SciFiCard>
                        ) : (
                            <LLMMonitor />
                        )}
                    </ScrollArea>
                </div>
            ): (
                <ScrollArea className="border-t-1 border-l-1 h-full overflow-auto pl-20 pt-4 w-full">
                    {sciFiMode ? (
                        <SciFiCard variant="scifiSolid" animated className="max-w-4xl mx-auto">
                            <SciFiCardHeader>
                                <SciFiCardTitle>⚡ NEX-ARIS AI Chat Terminal ⚡</SciFiCardTitle>
                                <SciFiCardStatus status="online">System Ready</SciFiCardStatus>
                            </SciFiCardHeader>
                            <SciFiCardContent>
                                <Chatbox/>
                            </SciFiCardContent>
                        </SciFiCard>
                    ) : (
                        <Chatbox/>
                    )}
                </ScrollArea>
            )}
            
            <SidePanel isOpen={false} width={500} toggleText={{open: "Settings", close: "Settings"}} >
                <div className="space-y-2 w-full flex flex-col items-start gap-4">
                    {sciFiMode && (
                        <SciFiCard variant="scifiGlass" className="w-full mb-4">
                            <SciFiCardHeader>
                                <SciFiCardTitle>🎛️ Neural Configuration</SciFiCardTitle>
                            </SciFiCardHeader>
                            <SciFiCardContent>
                                <SciFiCriticalButton className="w-full mb-3">
                                    Initialize AI Core
                                </SciFiCriticalButton>
                            </SciFiCardContent>
                        </SciFiCard>
                    )}
                    
                    <div className="flex flex-col items-start gap-2">
                        <label className="text-sm font-medium">AI Model Selector</label>
                        <AIModelSelector />
                    </div>
                    <SettingTextbox id="llm.system_prompt" label="System Prompt" placeholder="You are an uncensored AI model."/>
                    <SettingSwitch id="llm.showMonitor" label="Show Monitor" description="Show the LLM monitor in the right side of the screen."/>
                    <SettingSwitch id="llm.enableMemoryRetrieval" label="Enable Memory Retrieval" description="Retrieve relevant context from memory when making LLM requests."/>
                    
                    <div className="w-full border-t pt-4">
                        <label className="text-sm font-medium mb-4 block">Sampling Parameters</label>
                        <div className="grid grid-cols-1 gap-6">
                            <SettingSlider 
                                id="llm.top_k" 
                                label="Top K" 
                                description="Limits the model to consider only the top K most likely tokens"
                                min={1} 
                                max={100} 
                                step={1} 
                                defaultValue={40} 
                            />
                            <SettingSlider 
                                id="llm.top_p" 
                                label="Top P (Nucleus Sampling)" 
                                description="Cumulative probability threshold for token selection"
                                min={0.01} 
                                max={1} 
                                step={0.01} 
                                defaultValue={0.95} 
                            />
                            <SettingSlider 
                                id="llm.min_p" 
                                label="Min P" 
                                description="Minimum probability threshold for token selection"
                                min={0.01} 
                                max={0.5} 
                                step={0.01} 
                                defaultValue={0.05} 
                            />
                            <SettingSlider 
                                id="llm.repeat_penalty" 
                                label="Repeat Penalty" 
                                description="Penalty for repeating tokens (higher = less repetition)"
                                min={0.5} 
                                max={2.0} 
                                step={0.01} 
                                defaultValue={1.1} 
                            />
                            <SettingSlider 
                                id="llm.temperature" 
                                label="Temperature" 
                                description="Controls randomness in generation (higher = more creative)"
                                min={0.1} 
                                max={2.0} 
                                step={0.01} 
                                defaultValue={0.8} 
                            />
                            <SettingTextbox 
                                id="llm.seed" 
                                label="Seed" 
                                description="Random seed for reproducible generation (-1 for random)"
                                className="h-6"
                                placeholder="-1 for random"
                            />
                        </div>
                    </div>
                </div>
            </SidePanel>
            {/* <SidePanel isOpen={false} side="right" width={500} togglePosition={180} toggleText={{open: "Monitor", close: "Monitor"}} >
            </SidePanel> */}
        </div>
    )
}

export default LLMPage