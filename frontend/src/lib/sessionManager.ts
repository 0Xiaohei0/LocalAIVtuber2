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

export async function updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    try {
        const response = await fetch('/api/chat/session/update-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, title }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to update session title');
        }
        
        return true;
    } catch (err) {
        console.error('Failed to update session title:', err);
        return false;
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

export const indexSession = async (sessionId: string, options?: {
    window_size?: number;
    stride?: number;
    format_style?: string;
}): Promise<boolean> => {
    try {
        const response = await fetch(`/api/chat/session/${sessionId}/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                window_size: options?.window_size || 3,
                stride: options?.stride || 1,
                format_style: options?.format_style || 'simple'
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to index session');
        }
        
        return true;
    } catch (err) {
        console.error('Failed to index session:', err);
        return false;
    }
};

export const removeSessionIndex = async (sessionId: string): Promise<boolean> => {
    try {
        const response = await fetch(`/api/chat/session/${sessionId}/index`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove session index');
        }
        
        return true;
    } catch (err) {
        console.error('Failed to remove session index:', err);
        return false;
    }
};

export const getSessionIndexStatus = async (sessionId: string) => {
    try {
        const response = await fetch(`/api/chat/session/${sessionId}/index/status`);
        
        if (!response.ok) {
            throw new Error('Failed to get session index status');
        }
        
        return await response.json();
    } catch (err) {
        console.error('Failed to get session index status:', err);
        return null;
    }
};

export const reindexAllSessions = async (): Promise<{
    success: boolean;
    message: string;
    reindexed_count?: number;
    failed_sessions?: string[];
    total_sessions?: number;
}> => {
    try {
        const response = await fetch('/api/chat/reindex-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
            throw new Error('Failed to reindex all sessions');
        }
        
        const data = await response.json();
        return {
            success: true,
            message: data.message,
            reindexed_count: data.reindexed_count,
            failed_sessions: data.failed_sessions,
            total_sessions: data.total_sessions
        };
    } catch (err) {
        console.error('Failed to reindex all sessions:', err);
        return {
            success: false,
            message: 'Failed to reindex all sessions'
        };
    }
};