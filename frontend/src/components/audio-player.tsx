import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
}

export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }

    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const seekTime = parseFloat(e.target.value);
    if (audio) {
      audio.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (time: number): string =>
    isNaN(time) ? "00:00" : new Date(time * 1000).toISOString().substr(14, 5);

  // Optional: sync play state if user manually pauses
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  return (
    <div className="border bg-background p-4 rounded-md dark:bg-input/30 dark:border-input">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <div className="flex items-center justify-between">
        <button
          onClick={togglePlay}
          className="border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 p-2 rounded-full"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <div className="flex-1 mx-4 flex justify-center">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 accent-input/50"
          />
        </div>

        <div className="text-sm w-12 text-right">
          {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
}
