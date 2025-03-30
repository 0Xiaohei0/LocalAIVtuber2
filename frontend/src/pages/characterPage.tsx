import Live2DCanvas from "@/components/live-2d-renderer"


function CharacterPage() {
    return (
        <div className="p-5">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Character</h3>
            <div className="w-fill h-fill">
                {/* <Live2DCanvas modelPath="src/assets/live2D/models/haru/haru_greeter_t03.model3.json" /> */}
                {/* <Live2DCanvas modelPath="src/assets/live2D/models/huohuo/huohuo.model3.json" /> */}
                <Live2DCanvas modelPath="src/assets/live2D/models/ariu/ariu.model3.json" />
            </div>
        </div>
    )
}

export default CharacterPage