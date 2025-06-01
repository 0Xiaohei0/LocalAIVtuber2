import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Square } from 'lucide-react';
import { pipelineManager } from "@/lib/pipelineManager";
import { useSettings } from '@/context/SettingsContext';
import { cut5 } from '@/lib/utils';

type HistoryItem = {
    role: "assistant" | "user";
    content: string;
}

const Chatbox = () => {
    const [displayedMessages, setDisplayedMessages] = useState<HistoryItem[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesRef = useRef<HistoryItem[]>([]);
    const { settings } = useSettings();
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        const handlePipelineUpdate = () => {
            handleInterrupt();
            const task = pipelineManager.getNextTaskForLLM();
            if (!task) return;
            const input = task.input!;
            handleSend(input, task.id)
        };

        const unsubscribe = pipelineManager.subscribe(handlePipelineUpdate);

        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        inputRef.current?.focus();
    }, [isProcessing]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [displayedMessages]);

    const handleInterrupt = () => {
        const currentTask = pipelineManager.getCurrentTask()
        if (currentTask?.status == "pending_interruption" && !currentTask.interruptionState?.llm) {
            setIsProcessing(false);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            pipelineManager.markInterruptionState("llm");
            return;
        }
    }

    const createNewSession = async () => {
        try {
            const response = await fetch('/api/chat/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: `New Chat`
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create session');
            }
            
            const session = await response.json();
            return session.id;
        } catch (err) {
            console.error('Failed to create session:', err);
            return null;
        }
    };

    const updateSession = async (history: HistoryItem[]) => {
        console.log("Updating session:", sessionId, history);
        if (sessionId === null) return;
        const response = await fetch(`/api/chat/session/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, history })
        });
        if (!response.ok) {
            console.error("Error updating session:", response.statusText);
        }
    }

    const handleSend = async (input: string, taskId?: string | null) => {
        if (input.trim() === '') return;
        if (!taskId) taskId = null;
        else pipelineManager.markLLMStarted(taskId);

        setIsProcessing(true);
        const systemMessage = settings["llm.system_prompt"];
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const userMessage: HistoryItem = { role: 'user', content: input };
        const history: HistoryItem[] = messagesRef.current.slice(-30);
        setDisplayedMessages((prev) => [...prev, userMessage]);
        setInput('');

        try {
            const response = await fetch('/api/completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: input,
                    history: history,
                    systemPrompt: systemMessage
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error during completion:", errorData?.error);
                setIsProcessing(false);
                return;
            }
            if (sessionId === null) {
                const newSessionId = await createNewSession();
                if (newSessionId) {
                    setSessionId(newSessionId);
                }
            }

            messagesRef.current.push({ role: 'user', content: input });
            updateSession(messagesRef.current);

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
                setDisplayedMessages((prevMessages) => {
                    const lastMessage = prevMessages[prevMessages.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant') {
                        return [
                            ...prevMessages.slice(0, -1),
                            { ...lastMessage, content: aiMessage }
                        ];
                    } else {
                        return [
                            ...prevMessages,
                            { role: 'assistant', content: aiMessage }
                        ];
                    }
                });

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

            messagesRef.current.push({ role: 'assistant', content: aiMessage });
            updateSession(messagesRef.current);
            setIsProcessing(false);
            inputRef.current?.focus();

        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Fetch error:', error);
            }
        }
    };

    return (
        <div className="flex flex-col max-w-3xl mx-auto h-[calc(100vh-50px-17px)]">
            <div className="flex flex-col space-y-4 mb-4 flex-grow">
                {displayedMessages.map((msg, index) => (
                    <React.Fragment key={index}>
                        <div
                            className={`break-words max-w-7/10 px-4 py-2 has-[>svg]:px-3 gap-2 rounded-md text-sm font-medium shadow-xs ${msg.role === 'user' ? 'bg-primary text-primary-foreground self-end' : 'bg-secondary text-secondary-foreground self-start'
                                }`}
                        >
                            {msg.content}
                        </div>
                    </React.Fragment>
                ))}
                <div ref={messagesEndRef}></div>
            </div>
            <div className="sticky bottom-0 bg-background rounded-t-lg">
                <div className='mb-4 flex w-full items-center space-x-2 bg-secondary rounded-lg px-4 py-6'>
                    <Input
                        ref={inputRef}
                        disabled={isProcessing}
                        value={input}
                        placeholder="Type your message here."
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
                    />
                    <Button onClick={() => handleSend(input)}>
                        {!isProcessing ? <Send></Send> : <Square></Square>}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Chatbox;