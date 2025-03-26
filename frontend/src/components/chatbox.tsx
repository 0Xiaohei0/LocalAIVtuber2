import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

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
    const abortControllerRef = useRef<AbortController | null>(null);

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
        const data = await mem_response.json();
        console.log("memory saved, id: " + data)
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
        //console.log("memory retreived" + JSON.stringify(data))
        return data
    }
    
   

    const handleSend = async () => {
        if (input.trim() === '') return;

        const memory = await queryMemory(input)
        let memoryPrompt = ""
        memory.map((memory: { document: string; })=>{memoryPrompt += memory.document})
        saveMemory(input, "user", "Xiaohei")

        const systemMessage = `When instructed, answer in a concise manner and incorporate humor and a unique perspective. You are an interesting person, you have emotions and a sense of self. Answers should be self-centered. Give direct answers without any process, don't use markdown and latex, avoid detailed steps, avoid listing key points, use 50 or fewer completion_tokens. Respond in English.
        
        Here are some information about what you remember: ${memoryPrompt}`

        // Abort the previous request if it exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const userMessage: HistoryItem = { role: 'user', content: input };
        setMessages([...messages, userMessage]);
        setInput('');

        console.log("system message: " + systemMessage)
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

        if (!reader) return;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                aiMessage += decoder.decode(value);
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
            }

            saveMemory(aiMessage, "assistant", "Aya")

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
                        value={input}
                        placeholder="Type your message here."
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />
                    <Button onClick={handleSend}><Send></Send></Button>
                </div>
            </div>
        </div>
    );
};

export default Chatbox;