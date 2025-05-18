import React from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/context/SettingsContext";
import { Button } from "./ui/button";

interface SettingsDropdownProps {
    id: string;
    label: string;
    description: string;
    options: string[];
}

const SettingDropdown: React.FC<SettingsDropdownProps> = ({ id, label, description, options }) => {
    const { settings, updateSetting } = useSettings();

    return (
        <div className="flex items-center space-x-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        {settings[id]}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {options.map((option) => (
                        <DropdownMenuItem key={option} onClick={() => updateSetting(id, option)}>{option}</DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <Label htmlFor={id}>{label}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
};

export default SettingDropdown;