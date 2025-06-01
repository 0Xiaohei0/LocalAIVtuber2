import { HistoryItem } from "./types";

export async function createNewSession(): Promise<string | null> {
    try {
        const response = await fetch('/api/chat/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Chat' }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to create session');
        }
        
        const session = await response.json();
        return session.id;
    } catch (err) {
        console.error('Failed to create session:', err);
        return null;
    }
}

export async function updateSession(sessionId: string | null, history: HistoryItem[]) {
    if (sessionId === null) return;
    
    const response = await fetch(`/api/chat/session/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, history })
    });
    
    if (!response.ok) {
        console.error("Error updating session:", response.statusText);
    }
}