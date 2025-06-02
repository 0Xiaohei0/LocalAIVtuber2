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

export const fetchSessions = async () => {
    try {
        const response = await fetch('/api/chat/sessions');
        if (!response.ok) {
            throw new Error('Failed to fetch sessions');
        }
        const data = await response.json();
        return data;
    } catch (err) {
        console.error('Failed to fetch sessions:', err);
        return [];
    }
};

export const fetchSessionContent = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/session/${sessionId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch session')
      }
      const data = await response.json()
      return data
    } catch (err) {
      console.error('Failed to fetch session content:', err);
      return null;
    }
  }

export const deleteSession = async (sessionId: string) => {
    try {
        const response = await fetch(`/api/chat/session/${sessionId}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete session');
        }
        
        await fetchSessions();
    } catch (err) {
        console.error('Failed to delete session:', err);
    }
};