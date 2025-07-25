import { useEffect, useState } from "react"
import Live2DCanvas from "@/components/live-2d-renderer"
import VRM3dCanvas from "@/components/vrm-3d-renderer"
import { SidePanel } from "@/components/side-panel"
import SettingSwitch from "@/components/setting-switch"
import SettingSlider from "@/components/setting-slider"
import { useSettings } from "@/context/SettingsContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { fetchLive2DModels, fetchVRMModels, CharacterModel } from "@/lib/characterModels"

export function CharacterRender() {
    const rendererSwitchId = "frontend.character.3d2dSwitch"
    const toggleRenderId = "frontend.character.renderModel"
    const selectedLive2DModelId = "frontend.character.selectedLive2DModel"
    const selectedVRMModelId = "frontend.character.selectedVRMModel"
    
    // Add setting IDs for Live2D position and scale controls
    const live2DXPositionId = "frontend.character.live2D.xPosition"
    const live2DYPositionId = "frontend.character.live2D.yPosition" 
    const live2DScaleId = "frontend.character.live2D.scale"
    
    const { settings, updateSetting } = useSettings()
    
    // State for dynamic model loading
    const [live2DModels, setLive2DModels] = useState<CharacterModel[]>([])
    const [vrmModels, setVrmModels] = useState<CharacterModel[]>([])
    const [modelsLoading, setModelsLoading] = useState(true)

    // Load models from backend
    useEffect(() => {
        const loadModels = async () => {
            setModelsLoading(true)
            try {
                const [live2DResult, vrmResult] = await Promise.all([
                    fetchLive2DModels(),
                    fetchVRMModels()
                ])
                setLive2DModels(live2DResult)
                setVrmModels(vrmResult)
            } catch (error) {
                console.error('Failed to load character models:', error)
            } finally {
                setModelsLoading(false)
            }
        }
        
        loadModels()
    }, [])

    useEffect(() => {
        const setDefaultModels = async () => {
            // Wait for models to load before setting defaults
            if (modelsLoading) return
            
            // Set default models if none selected
            if (!settings[selectedLive2DModelId] && live2DModels.length > 0) {
                await updateSetting(selectedLive2DModelId, live2DModels[0].path)
            }
            if (!settings[selectedVRMModelId] && vrmModels.length > 0) {
                await updateSetting(selectedVRMModelId, vrmModels[0].path)
            }
            
            // Set default Live2D position and scale if not set
            if (settings[live2DXPositionId] === undefined) {
                await updateSetting(live2DXPositionId, 50) // Center X (50%)
            }
            if (settings[live2DYPositionId] === undefined) {
                await updateSetting(live2DYPositionId, 100) // Bottom Y (100%)
            }
            if (settings[live2DScaleId] === undefined) {
                await updateSetting(live2DScaleId, 0.3) // Default scale
            }
        }

        setDefaultModels()
    }, [settings, updateSetting, selectedLive2DModelId, selectedVRMModelId, live2DXPositionId, live2DYPositionId, live2DScaleId, modelsLoading, live2DModels, vrmModels])

    const handleLive2DModelChange = async (modelPath: string) => {
        await updateSetting(selectedLive2DModelId, modelPath)
    }

    const handleVRMModelChange = async (modelPath: string) => {
        await updateSetting(selectedVRMModelId, modelPath)
    }

    return (
        <div className="relative h-screen overflow-hidden">
            <SidePanel width={400}>
                
                <div className="space-y-4">
                    
                    <SettingSwitch id={rendererSwitchId} label={"3D / 2D switch"} description={""} />
                    <SettingSwitch id={toggleRenderId} label={"Render model"} description={""} />
                </div>
                <div className="space-y-4 mt-4">
                    {/* Live2D Model Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="live2d-model-select">Live2D Model</Label>
                        <Select
                            value={settings[selectedLive2DModelId] || ""}
                            onValueChange={handleLive2DModelChange}
                            disabled={modelsLoading || live2DModels.length === 0}
                        >
                            <SelectTrigger className="w-full" id="live2d-model-select">
                                <SelectValue placeholder={modelsLoading ? "Loading models..." : "Select Live2D model"} />
                            </SelectTrigger>
                            <SelectContent>
                                {live2DModels.map((model: CharacterModel) => (
                                    <SelectItem key={model.path} value={model.path}>
                                        {model.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!modelsLoading && live2DModels.length === 0 && (
                            <p className="text-sm text-muted-foreground">No Live2D models found</p>
                        )}
                    </div>

                    {/* VRM Model Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="vrm-model-select">VRM Model</Label>
                        <Select
                            value={settings[selectedVRMModelId] || ""}
                            onValueChange={handleVRMModelChange}
                            disabled={modelsLoading || vrmModels.length === 0}
                        >
                            <SelectTrigger className="w-full" id="vrm-model-select">
                                <SelectValue placeholder={modelsLoading ? "Loading models..." : "Select VRM model"} />
                            </SelectTrigger>
                            <SelectContent>
                                {vrmModels.map((model: CharacterModel) => (
                                    <SelectItem key={model.path} value={model.path}>
                                        {model.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!modelsLoading && vrmModels.length === 0 && (
                            <p className="text-sm text-muted-foreground">No VRM models found</p>
                        )}
                    </div>
                    
                    {/* Live2D Position and Scale Controls */}
                    {settings[rendererSwitchId] && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium">Live2D Controls</h3>
                            
                            <SettingSlider
                                id={live2DXPositionId}
                                label="X Position"
                                description="Horizontal position (0% = left, 50% = center, 100% = right)"
                                min={-100}
                                max={200}
                                step={1}
                                defaultValue={50}
                            />
                            
                            <SettingSlider
                                id={live2DYPositionId}
                                label="Y Position"
                                description="Vertical position (0% = top, 50% = center, 100% = bottom)"
                                min={-100}
                                max={200}
                                step={1}
                                defaultValue={100}
                            />
                            
                            <SettingSlider
                                id={live2DScaleId}
                                label="Scale"
                                description="Model size (0.1 = very small, 1.0 = normal, 3.0 = very large)"
                                min={0.01}
                                max={5.0}
                                step={0.01}
                                defaultValue={0.3}
                            />
                        </div>
                    )}
                </div>
            </SidePanel>

            {settings[toggleRenderId] ? (
                <div>
                    {settings[rendererSwitchId] ? (
                        settings[selectedLive2DModelId] ? (
                            <Live2DCanvas 
                                modelPath={settings[selectedLive2DModelId]} 
                                xPosition={settings[live2DXPositionId] || 50}
                                yPosition={settings[live2DYPositionId] || 100}
                                scale={settings[live2DScaleId] || 0.3}
                            />
                        ) : (
                            <div className="flex items-center h-full w-full justify-center">
                                <h2 className="mt-10 scroll-m-20 pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
                                    {modelsLoading ? "Loading models..." : "No Live2D model selected"}
                                </h2>
                            </div>
                        )
                    ) : (
                        <VRM3dCanvas modelPath={settings[selectedVRMModelId]} />
                    )}
                </div>
            ) : (
                <div className="flex items-center h-full w-full justify-center">
                    <h2 className="mt-10 scroll-m-20 pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
                        Render Model turned off
                    </h2>
                </div>
            )}
        </div>
    )
}
