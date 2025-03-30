import React, { useState } from "react"
import Live2DCanvas from "@/components/live-2d-renderer"
import VRM3dCanvas from "@/components/vrm-3d-renderer"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ArrowRightFromLine } from "lucide-react"
import { Panel } from "./panel"

export function CharacterRender() {
    const [is2DRenderer, setIs2DRenderer] = useState(false)

    const toggleRenderer = () => {
        setIs2DRenderer((prev) => (!prev));
    }

    return (
        <div>
            <div className="absolute right-0 h-screen p-2">
                <button className="absolute left-[-40px] top-5 border p-2 rounded-md bg-background"><ArrowRightFromLine /></button>
                <Panel className="h-full">
                    <div className="flex justify-center items-center space-x-2 ">
                        <Label>{"3D (VRM)"}</Label>
                        <Switch onClick={toggleRenderer} />
                        <Label>{"2D (live2D)"}</Label>
                    </div>


                </Panel>
            </div>


            {/* <Live2DCanvas modelPath="src/assets/live2D/models/haru/haru_greeter_t03.model3.json" /> */}
            {/* <Live2DCanvas modelPath="src/assets/live2D/models/huohuo/huohuo.model3.json" /> */}
            {/* <Live2DCanvas modelPath="src/assets/live2D/models/ariu/ariu.model3.json" /> */}
            {is2DRenderer ? <Live2DCanvas modelPath="src/assets/live2D/models/ariu/ariu.model3.json" /> : <VRM3dCanvas />}



        </div>
    )
}
