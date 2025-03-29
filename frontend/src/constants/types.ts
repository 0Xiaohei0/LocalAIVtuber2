export type TaskResponse = {
  text: string;
  audio?: string;
  playback_finished?: boolean;
};

export type TaskStatus = "created" | "llm_started" | "llm_finished" | "task_finished" | "cancelled"

export type Task = {
  id: string;
  input?: string;
  response: TaskResponse[];
  status: TaskStatus;
};