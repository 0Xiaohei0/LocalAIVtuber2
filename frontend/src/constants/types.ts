export type TaskResponse = {
  text: string;
  audio?: string;
  playback_finished?: boolean;
};

export type TaskStatus =
  | "created"
  | "llm_started"
  | "llm_finished"
  | "tts_finished"
  | "task_finished"
  | "pending_interruption"
  | "cancelled"

export type Task = {
  id: string;
  input?: string;
  response: TaskResponse[];
  status: TaskStatus;
  interruptionState?: {
    tts: boolean;
    llm: boolean;
    audio: boolean;
  };
};