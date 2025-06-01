import { useState } from "react"
import { Edit3, Save, X, Trash } from "lucide-react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"

interface Message {
    role: string
    content: string
}

interface EditableChatHistoryProps {
    messages: Message[]
    sessionId: string
}

export default function EditableChatHistory({ messages, sessionId }: EditableChatHistoryProps) {
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null)
    const [editContent, setEditContent] = useState("")
    const [error, setError] = useState<string | null>(null)

    const startEditing = (index: number) => {
        setEditingMessageIndex(index)
        setEditContent(messages[index].content)
    }

    const saveEdit = async () => {
        if (editingMessageIndex === null) return

        try {
            const updatedHistory = [...messages]
            updatedHistory[editingMessageIndex] = {
                ...updatedHistory[editingMessageIndex],
                content: editContent
            }

            const response = await fetch(`/api/chat/session/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    history: updatedHistory
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to update message')
            }

            // Trigger a page reload to get the updated data
            window.location.reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update message')
        }
    }

    const cancelEdit = () => {
        setEditingMessageIndex(null)
        setEditContent("")
    }

    return (
        <div className="flex flex-col space-y-4">
            {messages.map((message, index) => (
                <div key={index} className="group relative flex flex-col gap-1.5">
                    <div
                        className={`break-words max-w-7/10 w-fit px-4 py-2 rounded-md text-sm font-medium shadow-xs ${message.role === 'user'
                                ? 'bg-primary text-primary-foreground self-end ml-auto'
                                : 'bg-secondary text-secondary-foreground self-start mr-auto'
                            }`}
                    >
                        {editingMessageIndex === index ? (
                            <div className="space-y-3">
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="min-h-24"
                                />
                                <div className="flex space-x-2">
                                    <Button size="sm" onClick={saveEdit}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                    </div>
                    {editingMessageIndex !== index && (
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${message.role === 'user'
                                ? 'self-end ml-auto'
                                : 'self-start mr-auto'
                            }`}>
                            <Button variant="ghost" size="sm" onClick={() => startEditing(index)}>
                                <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                                <Trash className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            ))}
            {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
    )
} 