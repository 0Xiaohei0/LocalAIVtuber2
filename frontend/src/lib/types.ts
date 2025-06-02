export type HistoryItem = {
    role: "assistant" | "user";
    content: string;
}

export interface Session {
    id: string
    title: string
    created_at: string
    history: HistoryItem[]
    indexed?: boolean
  }