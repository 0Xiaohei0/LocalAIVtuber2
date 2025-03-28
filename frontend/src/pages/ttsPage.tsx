import AudioPlayer from "@/components/audio-player";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { pipelineManager } from "@/lib/pipelineManager";

function TTSPage() {
    const [text, setText] = useState("");
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isProcessingRef = useRef(false);
    const isPlayingRef = useRef(false);

    useEffect(() => {
        const handlePipelineUpdate = () => {
            processNextTTS();
            processNextAudio();
        };

        const unsubscribe = pipelineManager.subscribe(handlePipelineUpdate);

        return () => {
            unsubscribe();
        };
    }, []);

    const generateAudioFromText = async (text: string): Promise<string> => {
        const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error("TTS generation failed");
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    };

    const handleSubmit = async () => {
        if (!text.trim()) {
            alert("Please enter some text.");
            return;
        }

        setIsLoading(true);
        setAudioUrl(null);

        try {
            const audioUrl = await generateAudioFromText(text);
            setAudioUrl(audioUrl);

            const audio = new Audio(audioUrl);
            audio.play();
        } catch (error) {
            console.error("Error fetching TTS audio:", error);
            alert("Failed to generate audio. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    const processNextTTS = async () => {
        //console.log("isProcessingRef.current: " + isProcessingRef.current)
        if (isProcessingRef.current) return;

        const next = pipelineManager.getNextTaskForTTS();
        //console.log("pipelineManager.getNextTaskForTTS(): " + pipelineManager.getNextTaskForTTS())
        if (!next) return;

        const { taskId, responseIndex, task } = next;
        const textToSpeak = task.response[responseIndex].text;

        isProcessingRef.current = true;

        try {
            const audioUrl = await generateAudioFromText(textToSpeak);
            pipelineManager.addTTSAudio(taskId, responseIndex, audioUrl);
            isProcessingRef.current = false;
        } catch (err) {
            console.error("TTS pipeline error:", err);
            isProcessingRef.current = false;
        }
    };

    const processNextAudio = async () => {
        if (isPlayingRef.current) return;
        const next = pipelineManager.getNextTaskForAudio()
        if (!next) return
        const { taskId, responseIndex, task } = next;
        const audioUrl = task.response[responseIndex].audio;
        // Optionally autoplay it here for preview/testing:
        isPlayingRef.current = true;
        const audio = new Audio(audioUrl!);
        audio.play();

        audio.onended = () => {
            isPlayingRef.current = false;
            pipelineManager.markPlaybackFinished(taskId, responseIndex)
        };
    }

    // useEffect(() => {
    //     console.log("useEffect called with tasks: " + JSON.stringify(tasks))
    //     processNextTTS();
    //     processNextAudio();
    // // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [tasks]); 

    return (
        <div className="p-5">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight pb-5">Text to speech</h3>

            <div className="grid grid-cols-2 grid-rows-1 gap-5">
                <div className="flex flex-col gap-4">
                    <Textarea
                        className=""
                        rows={4}
                        placeholder="Enter text to synthesize..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <Button
                        variant={"outline"}
                        onClick={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? "Generating..." : "Generate Audio"}
                    </Button>
                </div>

                <div className="flex items-center justify-center w-full">
                    {!audioUrl && (
                        <Panel className="h-full w-full flex text-center items-center justify-center">
                            <p>No Audio to Preview</p>
                        </Panel>
                    )}
                    {audioUrl && (
                        <div className="w-full mx-10">
                            <AudioPlayer audioUrl={audioUrl} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TTSPage;