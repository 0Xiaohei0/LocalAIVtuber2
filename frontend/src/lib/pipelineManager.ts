
import { Task } from "../constants/types"
import { v4 as uuidv4 } from "uuid";

type PipelineListener = (tasks: Task[]) => void;

class PipelineManager {
  private tasks: Task[] = [];
  private listeners: Set<PipelineListener> = new Set();

  subscribe(listener: PipelineListener) {
    this.listeners.add(listener);
    listener(this.tasks);
    return () => { this.listeners.delete(listener) };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener([...this.tasks]);
    }
  }

  getTasks() {
    return [...this.tasks];
  }

  getTaskById(id: string) {
    return this.tasks.find(t => t.id === id);
  }

  addInputTask(input: string): string {
    const id = uuidv4();
    const task: Task = {
      id,
      input,
      response: [],
      status: "created"
    };
    this.tasks.push(task);
    this.notify();
    return id;
  }

  createTaskFromLLM(input: string, initialResponse: string): string {
    const id = uuidv4();
    const task: Task = {
      id,
      input: input,
      response: [{ text: initialResponse }],
      status: "llm_started"
    };
    this.tasks.push(task);
    this.notify();
    return id;
  }

  addLLMResponse(taskId: string, text: string) {
    const task = this.getTaskById(taskId);
    if (!task || task.status == "cancelled") return;
    task.response.push({ text });
    this.notify();
  }

  markLLMStarted(taskId: string) {
    const task = this.getTaskById(taskId);
    if (task) {
      task.status = "llm_started";
      this.updateTaskStatus(task);
      this.notify();
    }
  }

  markLLMFinished(taskId: string) {
    const task = this.getTaskById(taskId);
    if (task) {
      task.status = "llm_finished";
      this.updateTaskStatus(task);
      this.notify();
    }
  }

  addTTSAudio(taskId: string, responseIndex: number, audioUrl: string) {
    const task = this.getTaskById(taskId);
    const response = task?.response?.[responseIndex];
    if (!task || !response || task.status == "cancelled") return;

    response.audio = audioUrl;
    this.updateTaskStatus(task);
    this.notify();
  }

  markPlaybackFinished(taskId: string, responseIndex: number) {
    const task = this.getTaskById(taskId);
    const response = task?.response?.[responseIndex];
    if (!task || !response) return;
    response.playback_finished = true;
    this.updateTaskStatus(task);
    this.notify();
  }

  getNextTaskForLLM() {
    return this.tasks.find(task => task.input && (task.status == "created"));
  }

  getNextTaskForTTS() {
    for (const task of this.tasks) {
      if (task.status == "cancelled") continue;
      for (let j = 0; j < task.response.length; j++) {
        const res = task.response[j];
        if (res.text && !res.audio) {
          return {
            taskId: task.id,
            responseIndex: j,
            task,
          };
        }
      }
    }
    return undefined;
  }

  getNextTaskForAudio() {
    for (const task of this.tasks) {
      if (task.status == "cancelled") continue;
      for (let j = 0; j < task.response.length; j++) {
        const res = task.response[j];
        if (res.text && res.audio && !res.playback_finished) {
          return {
            taskId: task.id,
            responseIndex: j,
            task,
          };
        }
      }
    }
    return undefined;
  }

  private updateTaskStatus(task: Task) {
    if (task.status == "cancelled") return
    const llmFinish = task.status == "llm_finished";
    const ttsFinish = task.status == "tts_finished";
    const allAudio = task.response.every(r => r.audio);
    const allPlayback = task.response.every(r => r.playback_finished);
    // console.log("llmFinish " + llmFinish)
    // console.log("ttsFinish " + ttsFinish)
    // console.log("allAudio " + allAudio)
    // console.log("allPlayback " + allPlayback)
    if (llmFinish && allAudio) {
        task.status = "tts_finished";
    }
    if (ttsFinish && allPlayback) {
      task.status = "task_finished";
    }
  }

  cancelPipeline() {
    const currentTask = this.getCurrentTask()
    if (currentTask && currentTask.status != "cancelled"){
      currentTask.status = "cancelled"
    }
    this.notify();
  }

  removeFinishedTasks(maxCount: number = 20) {
    const active = this.tasks.filter(t => !(t.status == "task_finished"));
    const recentFinished = this.tasks
      .filter(t => t.status == "task_finished")
      .slice(-maxCount);
    this.tasks = [...recentFinished, ...active];
    this.notify();
  }

  getCurrentTask(): Task | undefined {
    // Find the first task that is not finished or cancelled
    return this.tasks.find(task => task.status !== "task_finished" && task.status !== "cancelled");
  }

  reset() {
    this.tasks = [];
    this.notify();
  }
}

export const pipelineManager = new PipelineManager();