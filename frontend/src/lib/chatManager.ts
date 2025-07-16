import { HistoryItem } from './types';
import { pipelineManager } from './pipelineManager';
import { cut5 } from './utils';
import { createNewSession, updateSession, fetchSessionContent } from './sessionManager';

type ChatUpdateCallback = (messages: HistoryItem[]) => void;

export class ChatManager {
    private messages: HistoryItem[] = [];
    private sessionId: string | null = null;
    private abortController: AbortController | null = null;
    private systemPrompt: string = '';
    private visionPrompt: string = '';
    private ocrPrompt: string = '';
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

    public getSystemPrompt(): string {
        return this.systemPrompt;
    }

    public setSystemPrompt(systemPrompt: string) {
        this.systemPrompt = systemPrompt;
        this.notifySubscribers();
    }

    public getVisionPrompt(): string {
        return this.visionPrompt;
    }

    public setVisionPrompt(visionPrompt: string) {
        this.visionPrompt = visionPrompt;
        this.notifySubscribers();
    }

    public getOcrPrompt(): string {
        return this.ocrPrompt;
    }

    public setOcrPrompt(ocrPrompt: string) {
        this.ocrPrompt = ocrPrompt;
        this.notifySubscribers();
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
            // Fetch relevant context from memory
            let contextText = '';
            try {
                const contextRes = await fetch('/api/memory/context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: input, limit: 3 })
                });
                if (contextRes.ok) {
                    const contextData = await contextRes.json();
                    if (Array.isArray(contextData.context) && contextData.context.length > 0) {
                        contextText = contextData.context
                            .map((c: Record<string, unknown>) => typeof c.document === 'string' ? c.document : '')
                            .filter(Boolean)
                            .join('\n');
                    }
                }
            } catch (ctxErr) {
                console.warn('Failed to fetch context:', ctxErr);
            }

            // Prepend context to systemPrompt if available
            let systemPromptWithContext = this.systemPrompt;
            const visionSection = this.visionPrompt.trim() ? `The user is currently looking at: ${this.visionPrompt}\n\n` : '';
            const ocrSection = this.ocrPrompt.trim() ? `The text extracted from the screen is: ${this.ocrPrompt}\n\n` : '';
            const contextSection = contextText.trim() ? `Relevant context from memory:\n${contextText}\n\n` : '';
            
            if (visionSection || ocrSection || contextSection) {
                systemPromptWithContext = visionSection + ocrSection + contextSection + this.systemPrompt;
            }

            console.log("getCompletion", JSON.stringify({
                text: input,
                history: history,
                systemPrompt: systemPromptWithContext,
            }));
            const response = await fetch('/api/completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: input,
                    history: history,
                    systemPrompt: systemPromptWithContext
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

    public async continueMessage(index: number) {
        // take history from beginning of history to index
        const history = this.messages.slice(0, index + 1);
        // send history to backend
        const response = await fetch('/api/completion/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: history, systemPrompt: this.systemPrompt })
        });
        // get streaming response similar to sendMessage
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            // add to the existing message
            this.messages[index].content += chunk;
            this.notifySubscribers();
        }
        await updateSession(this.sessionId, this.messages);
        this.notifySubscribers();
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

    public async setSessionId(id: string | null) {
        this.sessionId = id;
        // update session chat history
        if (id) {
            const session = await fetchSessionContent(id);
            this.messages = session.history;
        }
        this.notifySubscribers();
    }
}

export const chatManager = new ChatManager(); 