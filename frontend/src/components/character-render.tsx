import Live2DCanvas from "@/components/live-2d-renderer"
import VRM3dCanvas from "@/components/vrm-3d-renderer"
import { SidePanel } from "./side-panel"
import SettingsItem from "./SettingsItem"
import { useSettings } from "@/context/SettingsContext"

export function CharacterRender() {
    const rendererSwitchId = "frontend.character.3d2dSwitch"
    const toggleRenderId = "frontend.character.renderModel"
    const {settings} = useSettings()
    return (
        <div className="relative h-screen overflow-hidden">

            <SidePanel>
                <SettingsItem id={rendererSwitchId} label={"3D / 2D switch"} description={""} ></SettingsItem>
                <SettingsItem id={toggleRenderId} label={"Render model"} description={""} ></SettingsItem>
            </SidePanel>


            {/* <Live2DCanvas modelPath="src/assets/live2D/models/haru/haru_greeter_t03.model3.json" /> */}
            {/* <Live2DCanvas modelPath="src/assets/live2D/models/huohuo/huohuo.model3.json" /> */}
            {/* <Live2DCanvas modelPath="src/assets/live2D/models/ariu/ariu.model3.json" /> */}

            {settings[toggleRenderId] ? (
                <div>
                    {settings[rendererSwitchId] ? (
                        <Live2DCanvas modelPath="/resource/live2D/models/ariu/ariu.model3.json" />
                    ) : (
                        <VRM3dCanvas />
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
