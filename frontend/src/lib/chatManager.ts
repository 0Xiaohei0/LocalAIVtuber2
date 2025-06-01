import { HistoryItem } from './types';
import { pipelineManager } from './pipelineManager';
import { cut5 } from './utils';
import { createNewSession, updateSession } from './sessionManager';


export class ChatManager {
    private messages: HistoryItem[] = [];
    private sessionId: string | null = null;
    private abortController: AbortController | null = null;
    private onMessageUpdate: ((messages: HistoryItem[]) => void) | null = null;
    private systemPrompt: string = '';

    constructor() {
        this.setupPipelineSubscription();
    }

    public setCallbacks(onMessageUpdate: (messages: HistoryItem[]) => void, systemPrompt: string) {
        this.onMessageUpdate = onMessageUpdate;
        this.systemPrompt = systemPrompt;
    }

    private setupPipelineSubscription() {
        const handlePipelineUpdate = () => {
            this.handleInterrupt();
            const task = pipelineManager.getNextTaskForLLM();
            if (!task) return;
            const input = task.input!;
            this.sendMessage(input, task.id, this.systemPrompt, this.onMessageUpdate ?? (() => {}));
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
        systemPrompt: string = "",
        onMessageUpdate: (messages: HistoryItem[]) => void = () => {}
    ): Promise<void> {
        if (input.trim() === '') return;
        if (!taskId) taskId = null;
        else pipelineManager.markLLMStarted(taskId);

        this.abortController = new AbortController();
        const userMessage: HistoryItem = { role: 'user', content: input };
        const history = this.messages.slice(-30);
        
        this.messages.push(userMessage);
        onMessageUpdate([...this.messages]);

        try {
            console.log("getCompletion", JSON.stringify({
                text: input,
                history: history,
                systemPrompt: systemPrompt
            }));
            const response = await fetch('/api/completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: input,
                    history: history,
                    systemPrompt: systemPrompt
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
                
                onMessageUpdate([...this.messages, { role: 'assistant', content: aiMessage }]);

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

            this.messages.push({ role: 'assistant', content: aiMessage });
            await updateSession(this.sessionId, this.messages);

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
    }

    public getSessionId(): string | null {
        return this.sessionId;
    }

    public setSessionId(id: string | null) {
        this.sessionId = id;
    }
} 