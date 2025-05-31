import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { useSession } from '@/context/SessionContext';

interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    history: Array<{
        role: string;
        content: string;
    }>;
}

export default function SessionList() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { selectedSessionId, setSelectedSessionId, createNewSession } = useSession();

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/chat/sessions');
            if (!response.ok) {
                throw new Error('Failed to fetch sessions');
            }
            const data = await response.json();
            setSessions(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSession = async () => {
        const sessionId = await createNewSession();
        if (sessionId) {
            await fetchSessions();
        }
    };

    const deleteSession = async (sessionId: string) => {
        try {
            const response = await fetch(`/api/chat/session/${sessionId}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete session');
            }
            
            // If the deleted session was selected, clear the selection
            if (selectedSessionId === sessionId) {
                setSelectedSessionId(null);
            }
            
            // Refresh the session list
            await fetchSessions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete session');
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    return (
        <div className="absolute top-0 left-0 w-60 h-full border-r border-gray-800 text-white">
            <div className="p-4 border-b border-gray-800">
                <Button 
                    onClick={handleCreateSession}
                    className="w-full flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </Button>
            </div>
            
            <div className="p-4">
                {loading && <p className="text-gray-400">Loading...</p>}
                {error && <p className="text-red-400">{error}</p>}
                
                <ul className="space-y-2">
                    {sessions.map((session) => (
                        <li 
                            key={session.id}
                            className={`p-2 rounded hover:bg-white/10 cursor-pointer group ${selectedSessionId === session.id ? 'bg-white/10' : ''}`}
                            onClick={() => setSelectedSessionId(session.id)}
                        >
                            <div className="flex justify-between items-center">
                                <span className="truncate">{session.title}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteSession(session.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="text-xs text-gray-400">
                                {new Date(session.created_at).toLocaleDateString()}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}