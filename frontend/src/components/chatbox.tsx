import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Square } from 'lucide-react';
import { pipelineManager } from "@/lib/pipelineManager";

type HistoryItem = {
    role: "assistant" | "user";
    content: string;
}
type ChatboxProps = {
    sessionId: string;
};

const Chatbox: React.FC<ChatboxProps> = ({ sessionId }) => {
    const [displayedMessages, setDisplayedMessages] = useState<HistoryItem[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesRef = useRef<HistoryItem[]>([]);

    // useEffect(() => {
    //     if (pendingInput && sessionId) {
    //         handleSend(pendingInput); // Retry sending the message once sessionId is available
    //         setPendingInput(null); // Clear pending input
    //     }
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [sessionId, pendingInput]);

    useEffect(() => {
        messagesRef.current = displayedMessages;
    }, [displayedMessages]);

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
        if (sessionId) {
            getMemory();
        }
    }, [sessionId]);

    useEffect(() => {
        inputRef.current?.focus();
    }, [isProcessing]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [displayedMessages]);

    const getMemory = async () => {
        try {
            const res = await fetch(`/api/memory/session/messages?session_id=${encodeURIComponent(sessionId)}`);
            const data = await res.json();

            if (!res.ok) {
                console.error("Error fetching session memory:", data?.error);
                return;
            }
            if (!data.response) {
                console.error("Unexpected response format:", data);
                return;
            }
            // Convert to HistoryItem[]
            const history: HistoryItem[] = data.response.map((msg: { role: "assistant" | "user"; message: string }) => ({
                role: msg.role,
                content: msg.message
            }));

            setDisplayedMessages(history);
        } catch (error) {
            console.error("Fetch error:", error);
        }
    };

    

    const handleInterrupt = () => {
        const currentTask = pipelineManager.getCurrentTask()
        if (currentTask?.status == "pending_interruption" && !currentTask.interruptionState?.llm) {
            // console.log("interrupting llm...")
            setIsProcessing(false); // Update state
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            pipelineManager.markInterruptionState("llm");
            // console.log("llm interrupted.")
            return;
        }
    }

    const handleSend = async (input: string, taskId?: string | null) => {
        console.log("handle send called")
        if (input.trim() === '') return;
        if (!taskId) taskId = null;
        else pipelineManager.markLLMStarted(taskId);

        setIsProcessing(true); // Update state
        // if (!sessionId) {
        //     setPendingInput(input); // Save input and wait for sessionId
        //     onCreateSession();
        //     return;
        // }

        //const memory = await queryMemory(input)
        // let memoryPrompt = ""
        // memory.map((memory: MemoryQuery) => { memoryPrompt += `At ${memory.time}, ${memory.name} said: ${memory.message} \n` })
        //setMemoryUsed(memory)

        //saveMemory(input, "user", "Xiaohei");

        //const systemMessage = `You remember some past conversations: ${memoryPrompt}`;
        const systemMessage = ``;
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const userMessage: HistoryItem = { role: 'user', content: input };
        const history: HistoryItem[] = messagesRef.current;
        setDisplayedMessages((prev) => [...prev, userMessage]);
        setInput('');

        console.log("sending completion:" + JSON.stringify({
            text: input,
            history: history,
            systemPrompt: systemMessage
        }))
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
                const sentenceMatches = currentText.match(/[^.!?]+[.!?]/g);
                if (!sentenceMatches) continue;
                for (const sentence of sentenceMatches) {
                    const trimmed = sentence.trim();

                    if (trimmed.length > 0) {
                        if (taskId === null) {
                            taskId = pipelineManager.createTaskFromLLM(input, trimmed);
                        } else {
                            pipelineManager.addLLMResponse(taskId, trimmed);
                        }
                    }

                    const lastMatch = sentenceMatches[sentenceMatches.length - 1];
                    const endOfLastMatch = currentText.indexOf(lastMatch) + lastMatch.length;
                    currentText = currentText.slice(endOfLastMatch);
                }
            }

            if (taskId !== null) {
                pipelineManager.markLLMFinished(taskId);
            }

            //saveMemory(aiMessage, "assistant", "Aya");
            setIsProcessing(false); // Reset state
            inputRef.current?.focus(); // Autofocus the input textbox

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
                <div>
                   
                </div>
                {/* Invisible div to scroll into view */}
                <div ref={messagesEndRef}></div>
            </div>
            <div className="sticky bottom-0 bg-background rounded-t-lg">
                <div className='mb-4 flex w-full items-center space-x-2 bg-secondary rounded-lg px-4 py-6'>
                    <Input
                        ref={inputRef} // Attach the ref to the input element
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