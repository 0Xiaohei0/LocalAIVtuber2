
import {Task} from "../constants/types"
import { v4 as uuidv4 } from "uuid";

type PipelineListener = (tasks: Task[]) => void;

class PipelineManager {
  private tasks: Task[] = [];
  private listeners: Set<PipelineListener> = new Set();

  subscribe(listener: PipelineListener) {
    this.listeners.add(listener);
    console.log("this.listeners.size: " + this.listeners.size)
    listener(this.tasks);
    return () => {this.listeners.delete(listener)};
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
    };
    this.tasks.push(task);
    this.notify();
    return id;
  }

  createTaskFromLLM(initialResponse: string): string {
    const id = uuidv4();
    const task: Task = {
      id,
      response: [{ text: initialResponse }],
    };
    this.tasks.push(task);
    this.notify();
    return id;
  }

  addLLMResponse(taskId: string, text: string) {
    const task = this.getTaskById(taskId);
    if (!task || task.cancelled) return;
    task.response.push({ text });
    this.notify();
  }

  markLLMFinished(taskId: string) {
    const task = this.getTaskById(taskId);
    if (task) {
      task.llm_finished = true;
      this.checkTaskFinished(task);
      this.notify();
    }
  }

  addTTSAudio(taskId: string, responseIndex: number, audioUrl: string) {
    const task = this.getTaskById(taskId);
    const response = task?.response?.[responseIndex];
    if (!task || !response || task.cancelled) return;

    response.audio = audioUrl;
    this.checkTaskFinished(task);
    this.notify();
  }

  markPlaybackFinished(taskId: string, responseIndex: number) {
    const task = this.getTaskById(taskId);
    const response = task?.response?.[responseIndex];
    if (!task || !response) return;

    response.playback_finished = true;
    this.notify();
  }

  getNextTaskForLLM() {
    return this.tasks.find(task => task.input && !task.llm_finished && !task.cancelled);
  }

  getNextTaskForTTS() {
    for (const task of this.tasks) {
      if (task.cancelled) continue;
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
      if (task.cancelled) continue;
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

  private checkTaskFinished(task: Task) {
    const allAudio = task.response.every(r => r.audio);
    if (task.llm_finished && allAudio) {
      task.task_finished = true;
    }
  }

  cancelPipeline() {
    this.tasks.forEach(t => (t.cancelled = true));
    this.notify();
  }

  removeFinishedTasks(maxCount: number = 20) {
    const active = this.tasks.filter(t => !t.task_finished);
    const recentFinished = this.tasks
      .filter(t => t.task_finished)
      .slice(-maxCount);
    this.tasks = [...recentFinished, ...active];
    this.notify();
  }

  reset() {
    this.tasks = [];
    this.notify();
  }
}

export const pipelineManager = new PipelineManager();