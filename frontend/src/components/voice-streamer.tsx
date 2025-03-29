import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Panel } from "./panel";
import { ScrollArea } from "@radix-ui/react-scroll-area";

import { pipelineManager } from "@/lib/pipelineManager";

export default function VoiceStreamer() {
  const [isRecording, setIsRecording] = useState(false);
  const [probability, setProbability] = useState<number | null>(null);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    stopRecording()
    const socket = new WebSocket(
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host
      }/ws/audio`
    );
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "probability") {
        if (data.probability >= 0.3 && pipelineManager.getCurrentTask()?.status != "pending_interruption"){
          pipelineManager.interruptCurrentTask()
        }
        setProbability(data.probability);
      } else if (data.type === "transcription") {
        pipelineManager.addInputTask(data.text);
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
    <Panel className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Voice Input</h2>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2">
          <Button className=" max-w-1/2"
            variant={`${isRecording ? "destructive" : "outline"}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </Button>
          <div className="w-full">
            <p className="text-sm mb-1">Speech Probability:</p>
            <div className="w-full bg-gray-500 rounded-full h-2">
              <div
                className="bg-accent-foreground h-2 rounded-full"
                style={{ width: `${(probability ?? 0) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs mt-1 text-right">
              {probability ? `${(probability * 100).toFixed(2)}%` : "--"}
            </p>
          </div>
        </div>

        <Panel className="h-186">
          <ScrollArea className="h-full overflow-auto">
            <Table className="">
              <TableHeader>
                <TableRow>
                  <TableHead className="">Transcriptions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...transcriptions].reverse().map((text, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{text}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Panel>
      </div>
    </Panel>
  );
}
