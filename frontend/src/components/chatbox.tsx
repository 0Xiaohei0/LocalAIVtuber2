import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';


type HistoryItem = {
    role: "assistant" | "user" | "system";
    content: string;
}

const Chatbox: React.FC = () => {
    const [messages, setMessages] = useState<HistoryItem[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const saveMemory = async (input: string, speaker: string) => {
        const mem_response = await fetch('/api/memory/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                    text: input,
                    speaker: speaker
                })
        });
        const data = await mem_response.json();
        console.log("memory saved, id: " + data)
    }

    const handleSend = async () => {
        if (input.trim() === '') return;

        saveMemory(input, "User")

        // Abort the previous request if it exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

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
                 history: messages
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

           saveMemory(aiMessage, "Aya")

        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Fetch error:', error);
            }
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages]);

    return (
        <div className="flex flex-col max-w-3xl mx-auto h-full">
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