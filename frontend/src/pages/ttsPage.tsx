import AudioPlayer from "@/components/audio-player";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { pipelineManager } from "@/lib/pipelineManager";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { globalStateManager } from "@/lib/globalStateManager";

function TTSPage() {
    const [text, setText] = useState("");
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [voices, setVoices] = useState<string[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>("leaf");

    const abortControllerRef = useRef<AbortController | null>(null);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);

    const isProcessingRef = useRef(false);
    const isPlayingRef = useRef(false);
    

    const analyzeAudio = (audio: HTMLAudioElement) => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            const avgVolume = dataArray.reduce((a, b) => a + b, 0);
            const normalizedVolume = avgVolume / 15096;
            globalStateManager.updateState("ttsLiveVolume", normalizedVolume);
            if (!audio.paused) {
              requestAnimationFrame(updateVolume);
            }
          };

        updateVolume();
    };
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

    useEffect(() => {
        // Fetch available voices when component mounts
        fetchVoices();
    }, []);

    const fetchVoices = async () => {
        const response = await fetch('/api/tts/voices');
        const data = await response.json();
        if (data.voices) {
            setVoices(data.voices);
            if (data.current_voice) {
                setSelectedVoice(data.current_voice);
            }
        }
    };

    const handleVoiceChange = async (voice: string) => {
        try {
            const response = await fetch('/api/tts/voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ voice_name: voice })
            });
            const data = await response.json();
            if (response.ok) {
                setSelectedVoice(voice);
            } else {
                console.error(data.error || 'Failed to change voice');
            }
        } catch (error) {
            console.error('Failed to change voice:', error);
        }
    };

    const generateAudioFromText = async (text: string): Promise<string> => {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: abortController.signal
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
        // handle interruption
        const currentTask = pipelineManager.getCurrentTask()
        if (currentTask?.status == "pending_interruption" && !currentTask.interruptionState?.tts) {
            // console.log("interrupting tts...")
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            isProcessingRef.current = false
            pipelineManager.markInterruptionState("tts");
            // console.log("tts interrupted.")
            return;
        }
        
        if (isProcessingRef.current) return;

        const next = pipelineManager.getNextTaskForTTS();
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
        // handle interruption
        const currentTask = pipelineManager.getCurrentTask()
        if (currentTask?.status == "pending_interruption" && !currentTask.interruptionState?.audio) {
            // console.log("interrupting Audio...")
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current.currentTime = 0;
                currentAudioRef.current = null;
            }
            isPlayingRef.current = false;
            pipelineManager.markInterruptionState("audio");
            // console.log("Audio interrupted.")
            return;
        }

        if (isPlayingRef.current) return;

        const next = pipelineManager.getNextTaskForAudio()
        if (!next) return

        const { taskId, responseIndex, task } = next;

        const audioUrl = task.response[responseIndex].audio;
        isPlayingRef.current = true;

        const audio = new Audio(audioUrl!);
        currentAudioRef.current = audio;
        audio.play();
        analyzeAudio(audio);

        audio.onended = () => {
            isPlayingRef.current = false;
            currentAudioRef.current = null;
            pipelineManager.markPlaybackFinished(taskId, responseIndex)
        };
    }

    return (
        <div className="p-5">
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight pb-5">Text to speech</h3>

            <div className="grid grid-cols-2 grid-rows-2 gap-5">
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

                <Panel className=" flex flex-col gap-4">
                    <h3>Settings</h3>
                    <div className="flex items-center space-x-2">
                        <div className="flex flex-col gap-2">
                            <Label >Voice</Label>
                            <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue placeholder="Select a voice" />
                                </SelectTrigger>
                                <SelectContent>
                                    {voices.map((voice) => (
                                        <SelectItem key={voice} value={voice}>
                                            {voice}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    );
}

export default TTSPage;