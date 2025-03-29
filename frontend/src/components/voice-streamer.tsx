import { useEffect, useRef, useState } from "react";

export default function VoiceStreamer() {
  const [isRecording, setIsRecording] = useState(false);
  const [probability, setProbability] = useState<number | null>(null);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${
        window.location.host
      }/ws/audio`
    );
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "probability") {
        setProbability(data.probability);
      } else if (data.type === "transcription") {
        setTranscriptions((prev) => [...prev, data.text]);
      }
    };
    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const startRecording = async () => {
    await fetch("/api/record/start", { method: "POST" });
    setIsRecording(true);
  };

  const stopRecording = async () => {
    await fetch("/api/record/stop", { method: "POST" });
    setIsRecording(false);
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">🎙️ Server Microphone Stream</h2>
      <button
        className={`px-4 py-2 rounded-xl shadow-md ${
          isRecording ? "bg-red-500" : "bg-green-500"
        } text-white`}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      <div className="mt-4">
        <p className="text-sm">Speech Probability:</p>
        <p className="text-lg font-bold">{probability?.toFixed(2) ?? "--"}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm">Transcriptions:</p>
        <ul className="list-disc ml-4">
          {transcriptions.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
