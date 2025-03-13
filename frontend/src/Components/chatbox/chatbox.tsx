import React, { useState } from 'react';
import "./chatbox.css";

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
        <div className="chat-container">
            <div className="chat-box">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.sender}`}>
                        <strong>{msg.sender === "user" ? "You" : "AI"}:</strong> {msg.text}
                    </div>
                ))}
            </div>
            <div className="chat-input-container">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="chat-input"
                    placeholder="Type a message..."
                />
                <button onClick={handleSend} className="chat-send">Send</button>
            </div>
        </div>
    );
};

export default Chatbox;