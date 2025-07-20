import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/context/SettingsContext";

interface SettingsSliderProps {
    id: string;
    label: string;
    description: string;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
}

const SettingSlider: React.FC<SettingsSliderProps> = ({ 
    id, 
    label, 
    description, 
    min = 0, 
    max = 100, 
    step = 1, 
    defaultValue = 0 
}) => {
    const { settings, updateSetting } = useSettings();
    
    // Get the current value from settings, fallback to defaultValue
    const currentValue = settings[id] !== undefined ? Number(settings[id]) : defaultValue;
    
    const handleValueChange = (value: number[]) => {
        updateSetting(id, value[0]);
    };

    return (
        <div className="flex flex-col space-y-2 w-full">
            <div className="flex items-center justify-between">
                <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
                <span className="text-sm text-muted-foreground font-mono">
                    {currentValue}
                </span>
            </div>
            <Slider
                id={id}
                min={min}
                max={max}
                step={step}
                value={[currentValue]}
                onValueChange={handleValueChange}
                className="w-full"
            />
            <p className="text-xs text-muted-foreground">{description}</p>
        </div>
    );
};

export default SettingSlider; 