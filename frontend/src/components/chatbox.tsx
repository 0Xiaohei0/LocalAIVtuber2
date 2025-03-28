import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Square } from 'lucide-react';
import { pipelineManager } from "@/lib/pipelineManager";
import { usePipelineSubscription } from "@/hooks/use-pipeline-subscriptions";

type HistoryItem = {
    role: "assistant" | "user";
    content: string;
}
type ChatboxProps = {
    sessionId: string;
};

const Chatbox: React.FC<ChatboxProps> = ({ sessionId }) => {
    const [messages, setMessages] = useState<HistoryItem[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isProcessingRef = useRef<boolean>(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const { tasks } = usePipelineSubscription();

    useEffect(() => {
        const task = pipelineManager.getNextTaskForLLM();
        if (!task) return;
        const input = task.input!;
        handleSend(input)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks]);

    useEffect(() => {
        const getMemory = async () => {
            try {
                const res = await fetch(`/api/memory/session/messages?session_id=${encodeURIComponent(sessionId)}`);
                const data = await res.json();

                if (!res.ok) {
                    console.error("Error fetching session memory:", data?.error);
                    return;
                }

                // Convert to HistoryItem[]
                const history: HistoryItem[] = data.map((msg: { role: "assistant" | "user"; message: string }) => ({
                    role: msg.role,
                    content: msg.message
                }));

                setMessages(history);
            } catch (error) {
                console.error("Fetch error:", error);
            }
        }
        if (sessionId) {
            getMemory();
        }
    }, [sessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    const saveMemory = async (input: string, role: string, name: string) => {
        const mem_response = await fetch('/api/memory/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: input,
                role: role,
                name: name,
                session_id: sessionId
            })
        });
        await mem_response.json();
    }

    const queryMemory = async (input: string) => {
        const mem_response = await fetch('/api/memory/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: input,
                limit: 6
            })
        });
        const data = await mem_response.json();
        return data
    }



    const handleSend = async (input: string) => {
        // Abort the previous request if it exists
        if (isProcessingRef.current) {
            console.log("aborting pipeline")
            pipelineManager.cancelPipeline()
            isProcessingRef.current = false
            if (abortControllerRef.current){
                console.log("aborting llm request")
                abortControllerRef.current.abort();
            }
            return
        }
        if (input.trim() === '') return;

        isProcessingRef.current = true

        const memory = await queryMemory(input)
        let memoryPrompt = ""
        memory.map((memory: { document: string; }) => { memoryPrompt += memory.document })
        saveMemory(input, "user", "Xiaohei")

        const systemMessage = `When instructed, answer in a concise manner and incorporate humor and a unique perspective. You are an interesting person, you have emotions and a sense of self. Answers should be self-centered. Give direct answers without any process, don't use markdown and latex, avoid detailed steps, avoid listing key points, use 50 or fewer completion_tokens. Respond in English.
        
        Here are some information about what you remember: ${memoryPrompt}`


        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const userMessage: HistoryItem = { role: 'user', content: input };
        setMessages([...messages, userMessage]);
        setInput('');

        const response = await fetch('/api/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: input,
                history: messages,
                system: systemMessage
            }),
            signal: abortController.signal
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let aiMessage = '';
        let currentText = ''
        if (!reader) return;

        let taskId: string | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                aiMessage += chunk;
                setMessages((prevMessages) => {
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


                currentText += chunk
                // Split into sentences or punctuation-level chunks
                const sentenceMatches = currentText.match(/[^.!?]+[.!?]/g);
                if (!sentenceMatches) continue;
                for (const sentence of sentenceMatches) {
                    const trimmed = sentence.trim();

                    if (trimmed.length > 0) {
                        // Create task if this is the first sentence
                        if (taskId === null) {
                            taskId = pipelineManager.createTaskFromLLM(input, trimmed);
                        } else {
                            pipelineManager.addLLMResponse(taskId, trimmed);
                        }
                    }

                    // Remove all matched content from currentText
                    const lastMatch = sentenceMatches[sentenceMatches.length - 1];
                    const endOfLastMatch = currentText.indexOf(lastMatch) + lastMatch.length;
                    currentText = currentText.slice(endOfLastMatch);
                }
            }

            if (taskId !== null) {
                pipelineManager.markLLMFinished(taskId);
            }

            saveMemory(aiMessage, "assistant", "Aya")
            isProcessingRef.current = false

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
                {messages.map((msg, index) => (
                    <div
                        className={`break-words max-w-7/10 px-4 py-2 has-[>svg]:px-3 gap-2 rounded-md text-sm font-medium shadow-xs ${msg.role === 'user' ? 'bg-primary text-primary-foreground self-end' : 'bg-secondary text-secondary-foreground self-start'
                            }`}
                        key={index}
                    >
                        {msg.content}
                    </div>
                ))}
                {/* Invisible div to scroll into view */}
                <div ref={messagesEndRef}></div>
            </div>
            <div className="sticky bottom-0 bg-background rounded-t-lg">
                <div className='mb-4 flex w-full items-center space-x-2 bg-secondary rounded-lg px-4 py-6'>
                    <Input
                        disabled={isProcessingRef.current}
                        value={input}
                        placeholder="Type your message here."
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
                    />
                    <Button onClick={() => handleSend(input)}>
                        {!isProcessingRef.current ? <Send></Send> : <Square></Square>}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Chatbox;