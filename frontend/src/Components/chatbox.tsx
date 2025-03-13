import React, { useState } from 'react';

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
                ...prevMessages.filter((msg) => msg.sender !== 'ai'),
                { text: aiMessage, sender: 'ai' }
            ]);
        }
    };

    return (
        <div>
            <div style={{ height: '300px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px' }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                        <strong>{msg.sender === 'user' ? 'You' : 'AI'}:</strong> {msg.text}
                    </div>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                style={{ width: '80%', marginRight: '10px' }}
            />
            <button onClick={handleSend}>Send</button>
        </div>
    );
};

export default Chatbox;