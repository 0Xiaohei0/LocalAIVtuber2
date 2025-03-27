export type TaskResponse = {
  text: string;
  audio?: string;
  playback_finished?: boolean;
};

export type Task = {
  id: string;
  input?: string;
  response: TaskResponse[];
  llm_finished?: boolean;
  task_finished?: boolean;
  cancelled?: boolean;
};