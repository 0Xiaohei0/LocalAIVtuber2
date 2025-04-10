/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useEffect, useState } from "react";

interface SettingsContextType {
    settings: Record<string, any>;
    updateSetting: (key: string, value: any) => Promise<void>;
    loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                if (response.ok) {
                    setSettings(data.settings);
                } else {
                    console.error("Failed to fetch settings:", data.error);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const updateSetting = async (key: string, value: any) => {
        try {
            setLoading(true)
            const response = await fetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        [key]: value,
                    },
                }),
            });

            const data = await response.json();
            if (response.ok) {
                console.log("Settings updated successfully:", data.message);
                setSettings((prev) => ({
                    ...prev,
                    [key]: value,
                }));
            } else {
                console.error("Failed to update settings:", data.error);
            }
        } catch (error) {
            console.error("Error updating settings:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSetting, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
};