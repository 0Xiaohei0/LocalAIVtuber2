import React from "react";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/context/SettingsContext";
import { Textarea } from "./ui/textarea";

interface SettingsTextboxProps {
    id: string;
    label: string;
    description?: string;
    placeholder?: string;
    className?: string;
}

const SettingTextbox: React.FC<SettingsTextboxProps> = ({ id, label, description, placeholder, className }) => {
    const { settings, updateSetting } = useSettings();

    return (
        <div className={`flex flex-col items-start space-y-2 w-full ${className}`}>
            <Label htmlFor={id}>{label}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
            <Textarea
                id={id}
                value={settings[id] || ""}
                onChange={(e) => updateSetting(id, e.target.value)}
                placeholder={placeholder}
                className=" overflow-auto scrollbar-hide h-48"
            />
        </div>
    );
};

export default SettingTextbox;