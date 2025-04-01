import { useState } from "react"
import Live2DCanvas from "@/components/live-2d-renderer"
import VRM3dCanvas from "@/components/vrm-3d-renderer"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SidePanel } from "./side-panel"

export function CharacterRender() {
    const [is2DRenderer, setIs2DRenderer] = useState(false)
    const [renderModel, setRenderModel] = useState(false)

    const toggleRenderer = () => {
        setIs2DRenderer((prev) => (!prev));
    }

    const toggleRenderModel = () => {
        setRenderModel((prev) => (!prev));
    }


    return (
        <div className="relative h-screen overflow-hidden">

            <SidePanel>
                <div className="flex justify-center items-center space-x-2">
                    <Switch onClick={toggleRenderer} />
                    <Label>{"3D / 2D switch"}</Label>
                </div>
                <div className="flex justify-center items-center space-x-2">
                    <Switch onClick={toggleRenderModel} />
                    <Label>{"Render model"}</Label>
                </div>
            </SidePanel>


            {/* <Live2DCanvas modelPath="src/assets/live2D/models/haru/haru_greeter_t03.model3.json" /> */}
            {/* <Live2DCanvas modelPath="src/assets/live2D/models/huohuo/huohuo.model3.json" /> */}
            {/* <Live2DCanvas modelPath="src/assets/live2D/models/ariu/ariu.model3.json" /> */}

            {renderModel ? (
                <div>
                    {is2DRenderer ? (
                        <Live2DCanvas modelPath="src/assets/live2D/models/ariu/ariu.model3.json" />
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
