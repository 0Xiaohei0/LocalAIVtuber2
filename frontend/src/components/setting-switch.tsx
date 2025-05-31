import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/context/SettingsContext";

interface SettingsSwitchProps {
    id: string;
    label: string;
    description: string;
}

const SettingSwitch: React.FC<SettingsSwitchProps> = ({ id, label, description }) => {
    const { settings, updateSetting } = useSettings();

    return (
        <div className="flex items-center space-x-2">
            <Switch
                id={id}
                checked={settings[id] || false}
                onClick={() => updateSetting(id, !settings[id])}
            />
            <Label htmlFor={id}>{label}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
};

export default SettingSwitch;