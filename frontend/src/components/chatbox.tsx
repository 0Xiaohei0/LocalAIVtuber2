import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Square } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import EditableChatHistory from './editable-chat-history';
import { HistoryItem } from '@/lib/types';
import { ChatManager } from '@/lib/chatManager';

const Chatbox = () => {
    const [displayedMessages, setDisplayedMessages] = useState<HistoryItem[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { settings } = useSettings();
    const chatManagerRef = useRef<ChatManager>(new ChatManager());

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [displayedMessages]);

    const handleSend = async (input: string) => {
        if (input.trim() === '') return;
        setIsProcessing(true);
        setInput('');
        await chatManagerRef.current.sendMessage(
            input,
            null,
            settings["llm.system_prompt"],
            (messages: HistoryItem[]) => {
                setDisplayedMessages(messages);
                inputRef.current?.focus();
            }
        );
        setIsProcessing(false);
    };

    return (
        <div className="flex flex-col max-w-3xl mx-auto h-[calc(100vh-50px-17px)]">
            <div className="flex flex-col space-y-4 mb-4 flex-grow">
                <EditableChatHistory 
                    messages={displayedMessages} 
                    sessionId={chatManagerRef.current.getSessionId() ?? ""} 
                    onUpdate={(history) => {
                        setDisplayedMessages(history);
                        chatManagerRef.current.setMessages(history);
                    }} 
                />
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