import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

function TTSPage() {
    const [text, setText] = useState("");
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!text.trim()) {
            alert("Please enter some text.");
            return;
        }

        setIsLoading(true);
        setAudioUrl(null);

        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch TTS audio");
            }
            const audioBlob = await response.blob();
            const audioObjectUrl = URL.createObjectURL(audioBlob);
            setAudioUrl(audioObjectUrl);

            // Automatically play the audio
            const audio = new Audio(audioObjectUrl);
            audio.play();
        } catch (error) {
            console.error("Error fetching TTS audio:", error);
            alert("Failed to generate audio. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-2 grid-rows-3 p-5 gap-5">
            <Textarea 
                className=""
                rows={4}
                placeholder="Enter text to synthesize..."
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            <div>
                {audioUrl && (
                    <div className="mt-4">
                        <audio controls src={audioUrl} className="" />
                    </div>
                )}
            </div>
            
            <Button
                variant={"outline"}
                onClick={handleSubmit}
                disabled={isLoading}
            >
                {isLoading ? "Generating..." : "Generate Audio"}
            </Button>
            
        </div>
    );
}

export default TTSPage;