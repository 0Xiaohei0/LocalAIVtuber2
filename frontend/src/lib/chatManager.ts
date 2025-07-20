import { HistoryItem } from './types';
import { pipelineManager } from './pipelineManager';
import { cut5 } from './utils';
import { createNewSession, updateSession, fetchSessionContent } from './sessionManager';

type ChatUpdateCallback = (messages: HistoryItem[]) => void;

interface SubscriptionOptions {
    onMessagesChange?: boolean;
    onSystemPromptChange?: boolean;
    onVisionPromptChange?: boolean;
    onOcrPromptChange?: boolean;
    onImageChange?: boolean;
    onContextChange?: boolean;
    onFullSystemPromptChange?: boolean;
}

export class ChatManager {
    private messages: HistoryItem[] = [];
    private sessionId: string | null = null;
    private abortController: AbortController | null = null;
    private systemPrompt: string = '';
    private visionPrompt: string = '';
    private ocrPrompt: string = '';
    private currentImage: string = '';
    private retrievedContext: string = '';
    private fullSystemPrompt: string = '';
    private enableMemoryRetrieval: boolean = true;
    private subscribers: Map<ChatUpdateCallback, SubscriptionOptions> = new Map();

    constructor() {
        this.setupPipelineSubscription();
    }

    public subscribe(callback: ChatUpdateCallback, options: SubscriptionOptions = { onMessagesChange: true }): () => void {
        this.subscribers.set(callback, options);
        return () => this.subscribers.delete(callback);
    }

    private notifySubscribers(changeType: keyof SubscriptionOptions) {
        this.subscribers.forEach((options, callback) => {
            if (options[changeType]) {
                callback([...this.messages]);
            }
        });
    }

    public getSystemPrompt(): string {
        return this.systemPrompt;
    }

    public setSystemPrompt(systemPrompt: string) {
        this.systemPrompt = systemPrompt;
        this.notifySubscribers('onSystemPromptChange');
    }

    public getVisionPrompt(): string {
        return this.visionPrompt;
    }

    public setVisionPrompt(visionPrompt: string) {
        this.visionPrompt = visionPrompt;
        this.notifySubscribers('onVisionPromptChange');
    }

    public getOcrPrompt(): string {
        return this.ocrPrompt;
    }

    public setOcrPrompt(ocrPrompt: string) {
        this.ocrPrompt = ocrPrompt;
        this.notifySubscribers('onOcrPromptChange');
    }

    public getCurrentImage(): string {
        return this.currentImage;
    }

    public setCurrentImage(image: string) {
        this.currentImage = image;
        this.notifySubscribers('onImageChange');
    }

    public getRetrievedContext(): string {
        return this.retrievedContext;
    }

    public setRetrievedContext(context: string) {
        this.retrievedContext = context;
        this.notifySubscribers('onContextChange');
    }

    public setEnableMemoryRetrieval(enabled: boolean) {
        this.enableMemoryRetrieval = enabled;
        // Clear retrieved context immediately when memory retrieval is disabled
        if (!enabled) {
            this.setRetrievedContext('');
        }
    }

    public getFullSystemPrompt(): string {
        return this.fullSystemPrompt;
    }

    public setFullSystemPrompt(prompt: string) {
        this.fullSystemPrompt = prompt;
        this.notifySubscribers('onFullSystemPromptChange');
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
        this.notifySubscribers('onMessagesChange');

        try {
            // Fetch relevant context from memory (if enabled)
            let contextText = '';
            if (this.enableMemoryRetrieval) {
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
            } else {
                // Clear retrieved context when memory retrieval is disabled
                this.setRetrievedContext('');
            }

            // Assemble system prompt with labeled sections
            let systemPromptWithContext = '';
            
            // Add vision context if available
            const visionSection = this.visionPrompt.trim() ? 
                `[SCREEN CONTEXT]\n${this.visionPrompt}\n\n` : '';
            
            // Add OCR context if available    
            const ocrSection = this.ocrPrompt.trim() ? 
                `[SCREEN TEXT]\n${this.ocrPrompt}\n\n` : '';
            
            // Add memory context if available
            const contextSection = contextText.trim() ? 
                `[RETRIEVED MEMORY]\n${contextText}\n\n` : '';
            
            // Add base instructions
            const instructionsSection = `[INSTRUCTIONS]\n${this.systemPrompt}\n\n`;
            
            // Combine all sections
            systemPromptWithContext = visionSection + ocrSection + contextSection + instructionsSection;

            // Set the retrieved context and full system prompt
            this.setRetrievedContext(contextText);
            this.setFullSystemPrompt(systemPromptWithContext);

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
            this.notifySubscribers('onMessagesChange');

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
                this.notifySubscribers('onMessagesChange');

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
            this.notifySubscribers('onMessagesChange');

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
            this.notifySubscribers('onMessagesChange');
        }
        await updateSession(this.sessionId, this.messages);
        this.notifySubscribers('onMessagesChange');
    }

    public async regenerateMessage(index: number) {
        // Only regenerate assistant messages
        if (this.messages[index].role !== 'assistant') return;
        
        // take history from beginning up to (but not including) the message being regenerated
        const historyUpToMessage = this.messages.slice(0, index);
        
        // Get the user message that prompted this assistant response
        const lastUserMessage = historyUpToMessage[historyUpToMessage.length - 1];
        if (!lastUserMessage || lastUserMessage.role !== 'user') return;

        // Clear the current assistant message content
        this.messages[index].content = '';
        this.notifySubscribers('onMessagesChange');

        // Use the same context logic as sendMessage for consistency
        let contextText = '';
        if (this.enableMemoryRetrieval) {
            try {
                const contextRes = await fetch('/api/memory/context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: lastUserMessage.content, limit: 3 })
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
        }

        // Assemble system prompt with context (same logic as sendMessage)
        const visionSection = this.visionPrompt.trim() ? 
            `[SCREEN CONTEXT]\n${this.visionPrompt}\n\n` : '';
        const ocrSection = this.ocrPrompt.trim() ? 
            `[SCREEN TEXT]\n${this.ocrPrompt}\n\n` : '';
        const contextSection = contextText.trim() ? 
            `[RETRIEVED MEMORY]\n${contextText}\n\n` : '';
        const instructionsSection = `[INSTRUCTIONS]\n${this.systemPrompt}\n\n`;
        const systemPromptWithContext = visionSection + ocrSection + contextSection + instructionsSection;

        // Send completion request with history up to the user message
        const response = await fetch('/api/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: lastUserMessage.content,
                history: historyUpToMessage.slice(0, -1), // exclude the user message since it's passed as 'text'
                systemPrompt: systemPromptWithContext
            })
        });

        if (!response.ok) {
            console.error("Error during regeneration");
            return;
        }

        // Stream the new response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            this.messages[index].content += chunk;
            this.notifySubscribers('onMessagesChange');
        }
        
        await updateSession(this.sessionId, this.messages);
        this.notifySubscribers('onMessagesChange');
    }

    public getMessages(): HistoryItem[] {
        return this.messages;
    }

    public setMessages(messages: HistoryItem[]) {
        this.messages = messages;
        this.notifySubscribers('onMessagesChange');
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
        this.notifySubscribers('onMessagesChange');
    }
}

export const chatManager = new ChatManager(); 