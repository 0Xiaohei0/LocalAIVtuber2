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

    const handleSend = async () => {
        console.log('Sending message:', input);
        if (input.trim() === '') return;

        const userMessage: HistoryItem = { role: 'user', content: input };
        setMessages([...messages, userMessage]);
        setInput('');

        console.log(messages)
        const response = await fetch('/api/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                 text: input,
                 history: messages
                })
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let aiMessage = '';

        if (!reader) return;
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
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages]);

    return (
        <div className="flex flex-col max-w-3xl mx-auto h-full">
            <div className="flex flex-col space-y-4 mb-4 flex-grow">
                {messages.map((msg, index) => (
                    <div
                        className={`max-w-7/10 px-4 py-2 has-[>svg]:px-3 gap-2 rounded-md text-sm font-medium shadow-xs ${msg.role === 'user' ? 'bg-primary text-primary-foreground self-end' : 'bg-secondary text-secondary-foreground self-start'
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