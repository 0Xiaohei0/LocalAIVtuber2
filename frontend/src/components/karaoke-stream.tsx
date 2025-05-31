import { ArrowDownFromLine, ArrowUpFromLine, Plus, X } from "lucide-react";
import { Panel } from "./panel";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { useState } from "react";
import { songDataList } from "@/constants/song-data";
import { useSettings } from "@/context/SettingsContext";
import { SetlistEditor } from "@/components/setlist-editor";

export function KaraokeStream() {
    const { settings, updateSetting, loading } = useSettings();
    const [streamRunning, setStreamRunning] = useState(false);
    const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
    const setlist: string[] = settings["frontend.stream.karaoke_stream.setlist"] || [];
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const toggleSongSelection = (songName: string) => {
        setSelectedSongs((prev) =>
            prev.includes(songName)
                ? prev.filter((name) => name !== songName)
                : [...prev, songName]
        );
    };

    const addToSetlist = async () => {
        const updatedSetlist = [...setlist, ...selectedSongs];
        await updateSetting("frontend.stream.karaoke_stream.setlist", updatedSetlist);
        setSelectedSongs([]); // Clear selected songs after adding
        setIsDialogOpen(false); // Close the dialog
    };

    const removeFromSetlist = async (index: number) => {
        const updatedSetlist = setlist.filter((_, i) => i !== index);
        await updateSetting("frontend.stream.karaoke_stream.setlist", updatedSetlist);
    };

    const moveSongInSetlist = async (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;

        // Ensure target index is within bounds
        if (targetIndex >= 0 && targetIndex < setlist.length) {
            const updatedSetlist = [...setlist];
            // Swap songs
            [updatedSetlist[index], updatedSetlist[targetIndex]] = [
                updatedSetlist[targetIndex],
                updatedSetlist[index],
            ];
            await updateSetting("frontend.stream.karaoke_stream.setlist", updatedSetlist);
        }
    };

    const handleStartStream = async () => {
        if (setlist.length === 0) {
            alert("No songs in the setlist. Please add songs to start the stream.");
            return;
        }

        setStreamRunning(true);

        for (let i = 0; i < setlist.length; i++) {
            const currentSong = setlist[i];

            // Play the song audio
            await playSongAudio(currentSong);

            // Add a tag to the history
            addToHistory(`[sang a song] ${currentSong}`);

            // Chat interaction for 3 minutes
            const chatDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
            const chatEndTime = Date.now() + chatDuration;

            while (Date.now() < chatEndTime) {
                const chatMessages = await fetchChatMessages();
                const aiResponse = await generateAIResponse(chatMessages.join());
                displayChatResponse(aiResponse);

                // Check if the stream is stopped
                if (!streamRunning) {
                    return;
                }

                await delay(5000); // Wait for 5 seconds before fetching new messages
            }

            // Introduce the next song
            if (i < setlist.length - 1) {
                const nextSong = setlist[i + 1];
                const introduction = await generateAIResponse(
                    `Introduce the next song: ${nextSong}`
                );
                displayChatResponse(introduction);

                // Read the song title with TTS
                await playTTS(`The next song is ${nextSong}`);
            }
        }

        // Closing speech after the last song
        const closingSpeech = await generateAIResponse(
            "Give a closing speech for the karaoke stream."
        );
        displayChatResponse(closingSpeech);

        setStreamRunning(false);
        alert("Stream has ended.");
    };

    const playSongAudio = async (song: string) => {
        const songData = songDataList.find((data) => data.songName === song);
    
        if (!songData) {
            console.error(`Song not found: ${song}`);
            return;
        }
    
        // Create an HTMLAudioElement to play the song
        const audio = new Audio(songData.fileName);
    
        console.log(`Playing song: ${song} (${songData.fileName})`);
    
        // Play the audio and wait for it to finish
        await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = (error) => {
                console.error(`Error playing song: ${song}`, error);
                reject(error);
            };
            audio.play().catch((error) => {
                console.error(`Error starting playback for song: ${song}`, error);
                reject(error);
            });
        });
    };

    const addToHistory = (message: string) => {
        // Logic to add a message to the history
        console.log(`History updated: ${message}`);
    };

    const fetchChatMessages = async () => {
        // Logic to fetch chat messages from the stream
        return ["User: Great song!", "User: What's next?"];
    };

    const generateAIResponse = async (input: string) => {
        // Logic to generate an AI response using the LLM component
        return `AI: ${input}`;
    };

    const displayChatResponse = (response: string) => {
        // Logic to display the AI response in the chat
        console.log(response);
    };

    const playTTS = async (text: string) => {
        // Logic to play TTS audio for the given text
        console.log(`TTS: ${text}`);
        await delay(5000); // Simulate 5 seconds of TTS playback
    };

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    return (
        <div className="grid grid-cols-4 gap-10">
            <div>
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-2">Chat log</h3>
                <Panel></Panel>
            </div>
            <div>
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-2">Set list</h3>
                <Panel className="flex flex-col gap-4">
                    {loading && <div>Loading setlist...</div>}
                    {setlist.map((song, index) => (
                        <div key={index} className="flex items-center gap-2 w-full">
                            <Panel className="flex w-full py-0 px-0">
                                <div className="flex w-full my-4 ml-4 mr-0">
                                    <p>{song}</p>
                                    <div className="flex flex-col justify-between ml-auto">
                                        <Button
                                            className="size-1"
                                            variant="ghost"
                                            onClick={() => moveSongInSetlist(index, "up")}
                                            disabled={index === 0}
                                        >
                                            <ArrowUpFromLine></ArrowUpFromLine>
                                        </Button>
                                        <Button
                                            className="size-1"
                                            variant="ghost"
                                            onClick={() => moveSongInSetlist(index, "down")}
                                            disabled={index === setlist.length - 1}
                                        >
                                            <ArrowDownFromLine></ArrowDownFromLine>
                                        </Button>
                                    </div>
                                </div>
                                <Button className="size-1 mr-1 mt-1" variant="ghost" onClick={() => removeFromSetlist(index)}>
                                    <X></X>
                                </Button>
                            </Panel>
                        </div>
                    ))}

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger>
                            <Panel className="flex justify-center">
                                <Plus></Plus>
                            </Panel>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Songs</DialogTitle>
                                <DialogDescription>
                                    Select songs from the list below:
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-2">
                                {songDataList.map((song, index) => (
                                    <Button
                                        key={index}
                                        variant={selectedSongs.includes(song.songName) ? "default" : "outline"}
                                        onClick={() => toggleSongSelection(song.songName)}
                                    >
                                        {song.songName} - {song.artist}
                                    </Button>
                                ))}
                            </div>
                            <DialogFooter>
                                <Button onClick={addToSetlist} disabled={selectedSongs.length === 0}>
                                    Add to Setlist
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </Panel>
            </div>
            <div>
                <div>
                    <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-2">Filter</h3>
                    <Panel></Panel>
                </div>
                <div>
                    <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-2">Controls</h3>
                    <Panel>
                        <div className="flex">
                            <Button onClick={handleStartStream} variant={streamRunning ? "destructive" : "default"}>{streamRunning ? "Stop Stream" : "Start Stream"}</Button>
                        </div>
                    </Panel>
                </div>

            </div>

            <div>
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-2">Status</h3>
                <Panel><SetlistEditor></SetlistEditor></Panel>
            </div>
        </div>
    );
}