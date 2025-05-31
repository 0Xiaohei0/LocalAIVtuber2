import { createContext, useContext, useState, ReactNode } from 'react';

interface SessionContextType {
    selectedSessionId: string | null;
    setSelectedSessionId: (sessionId: string | null) => void;
    createNewSession: () => Promise<string | null>;
    refreshSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    const createNewSession = async () => {
        try {
            const response = await fetch('/api/chat/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: `New Chat`
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create session');
            }
            
            const session = await response.json();
            setSelectedSessionId(session.id);
            return session.id;
        } catch (err) {
            console.error('Failed to create session:', err);
            return null;
        }
    };

    const refreshSessions = async () => {
        // This is a no-op function that can be called to trigger a refresh
        // The actual refresh logic is in the SessionList component
        return;
    };

    return (
        <SessionContext.Provider value={{
            selectedSessionId,
            setSelectedSessionId,
            createNewSession,
            refreshSessions
        }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
} 