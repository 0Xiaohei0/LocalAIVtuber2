import { Panel } from "@/components/panel"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

function SettingsPage() {
    return (
        <div className="p-5">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Settings</h3>
            <Panel className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-2">
                    <Switch id="load-llm-cpu" />
                    <Label htmlFor="airplane-mode">Load LLM on CPU</Label>
                    <p className="text-sm text-muted-foreground">For Reducing load on lower end graphics cards, latency will be increased.</p>
                </div>
            </Panel>
        </div>
    )
}

export default SettingsPage