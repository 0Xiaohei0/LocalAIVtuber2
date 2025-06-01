import { HistoryItem } from './types';
import { pipelineManager } from './pipelineManager';
import { cut5 } from './utils';
import { createNewSession, updateSession } from './sessionManager';

type ChatUpdateCallback = (messages: HistoryItem[]) => void;

export class ChatManager {
    private messages: HistoryItem[] = [];
    private sessionId: string | null = null;
    private abortController: AbortController | null = null;
    private systemPrompt: string = '';
    private subscribers: Set<ChatUpdateCallback> = new Set();

    constructor() {
        this.setupPipelineSubscription();
    }

    public subscribe(callback: ChatUpdateCallback): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    private notifySubscribers() {
        this.subscribers.forEach(callback => callback([...this.messages]));
    }

    public setSystemPrompt(systemPrompt: string) {
        this.systemPrompt = systemPrompt;
    }

    private setupPipelineSubscription() {
        const handlePipelineUpdate = () => {
            this.handleInterrupt();
            const task = pipelineManager.getNextTaskForLLM();
            if (!task) return;
            const input = task.input!;
            this.sendMessage(input, task.id);
        };

        return pipelineManager.subscribe(handlePipelineUpdate);
    }

    public handleInterrupt() {
        const currentTask = pipelineManager.getCurrentTask();
        if (currentTask?.status === "pending_interruption" && !currentTask.interruptionState?.llm) {
            if (this.abortController) {
                this.abortController.abort();
            }
            pipelineManager.markInterruptionState("llm");
            return true;
        }
        return false;
    }

    public async sendMessage(
        input: string, 
        taskId: string | null = null,
    ): Promise<void> {
        if (input.trim() === '') return;
        if (!taskId) taskId = null;
        else pipelineManager.markLLMStarted(taskId);

        this.abortController = new AbortController();
        const userMessage: HistoryItem = { role: 'user', content: input };
        const history = this.messages.slice(-30);
        
        this.messages.push(userMessage);
        this.notifySubscribers();

        try {
            console.log("getCompletion", JSON.stringify({
                text: input,
                history: history,
                systemPrompt: this.systemPrompt
            }));
            const response = await fetch('/api/completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: input,
                    history: history,
                    systemPrompt: this.systemPrompt
                }),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error during completion:", errorData?.error);
                return;
            }

            if (this.sessionId === null) {
                const newSessionId = await createNewSession();
                if (newSessionId) {
                    this.sessionId = newSessionId;
                }
            }

            await updateSession(this.sessionId, this.messages);

            this.messages = [...this.messages, { role: 'user', content: input }];
            this.notifySubscribers();

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let aiMessage = '';
            let currentText = '';
            
            if (!reader) return;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                aiMessage += chunk;
                
                this.messages = [...this.messages.slice(0, -1), { role: 'assistant', content: aiMessage }];
                this.notifySubscribers();

                currentText += chunk;
                const { sentences, remaining } = cut5(currentText);
                
                if (sentences.length > 0) {
                    for (const sentence of sentences) {
                        const trimmed = sentence.trim();
                        if (trimmed.length > 0) {
                            if (taskId === null) {
                                taskId = pipelineManager.createTaskFromLLM(input, trimmed);
                            } else {
                                pipelineManager.addLLMResponse(taskId, trimmed);
                            }
                        }
                    }
                    currentText = remaining;
                }
            }

            if (currentText.length > 0) {
                if (taskId === null) {
                    taskId = pipelineManager.createTaskFromLLM(input, currentText);
                } else {
                    pipelineManager.addLLMResponse(taskId, currentText);
                }
            }

            if (taskId !== null) {
                pipelineManager.markLLMFinished(taskId);
            }
            
            await updateSession(this.sessionId, this.messages);
            this.notifySubscribers();

        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Fetch error:', error);
            }
        }
    }

    public getMessages(): HistoryItem[] {
        return this.messages;
    }

    public setMessages(messages: HistoryItem[]) {
        this.messages = messages;
        this.notifySubscribers();
    }

    public getSessionId(): string | null {
        return this.sessionId;
    }

    public setSessionId(id: string | null) {
        this.sessionId = id;
    }
}

export const chatManager = new ChatManager(); 