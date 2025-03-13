import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Chatbox: React.FC = () => {
    const [messages, setMessages] = useState<{ text: string, sender: 'user' | 'ai' }[]>([]);
    const [input, setInput] = useState('');

    const handleSend = async () => {
        console.log('Sending message:', input);
        if (input.trim() === '') return;

        const userMessage: { text: string, sender: 'user' | 'ai' } = { text: input, sender: 'user' };
        setMessages([...messages, userMessage]);
        setInput('');

        const response = await fetch('/api/completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input })
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let aiMessage = '';
        
        if (!reader) return;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            aiMessage += decoder.decode(value);
            setMessages((prevMessages) => [
                ...prevMessages,
                { text: aiMessage, sender: 'ai' }
            ]);
        }
    };

    return (
        <div className="p-4 bg-background">
            <div className="chat-box">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.sender}`}>
                        <strong>{msg.sender === "user" ? "You" : "AI"}:</strong> {msg.text}
                    </div>
                ))}
            </div>
            <div className="flex w-full items-center space-x-2">
                <Input 
                value={input} 
                placeholder="Type your message here." 
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button onClick={handleSend}>Send message</Button>
            </div>
        </div>
    );
};

export default Chatbox;