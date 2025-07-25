import { Panel } from "@/components/panel";
import SettingSwitch from "@/components/setting-switch";
import { useSettings } from "@/context/SettingsContext";

function SettingsPage() {
    const { loading } = useSettings();

    if (loading) {
        return <div>Loading settings...</div>;
    }

    return (
        <div className="p-5">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Settings</h3>
            <Panel className="max-w-4xl mx-auto flex flex-col gap-4">
                <SettingSwitch
                    id="load-llm-cpu"
                    label="Load LLM on CPU"
                    description="For reducing load on lower-end graphics cards, latency will be increased."
                />
                <SettingSwitch
                    id="disable-pipeline"
                    label="Disable Pipeline"
                    description="For testing individual pipeline stages without triggering the entire pipeline."
                />
                <SettingSwitch
                    id="llm.keep_model_loaded"
                    label="Keep LLM loaded"
                    description="For unloading LLM when inference finishes."
                />
            </Panel>
        </div>
    );
}

export default SettingsPage;