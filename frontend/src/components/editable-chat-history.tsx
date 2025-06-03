import { useState } from "react"
import { Edit3, Save, X, Trash, ArrowRight } from "lucide-react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { HistoryItem } from "@/lib/types"
import { TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { Tooltip } from "./ui/tooltip"
import { TooltipProvider } from "./ui/tooltip"
import { toast } from "sonner"

interface EditableChatHistoryProps {
    messages: HistoryItem[]
    sessionId: string
    onUpdate: (updatedHistory: HistoryItem[]) => void
    onContinue: (index: number) => void
}

export default function EditableChatHistory({ messages, sessionId, onUpdate, onContinue }: EditableChatHistoryProps) {
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null)
    const [editContent, setEditContent] = useState("")

    const startEditing = (index: number) => {
        setEditingMessageIndex(index)
        setEditContent(messages[index].content)
    }

    const continueMessage = (index: number) => {
        onContinue(index)
    }

    const deleteMessage = async (index: number) => {
        try {
            const updatedHistory = [...messages]
            updatedHistory.splice(index, 1)

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

            onUpdate(updatedHistory)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update message')
        }
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

            onUpdate(updatedHistory)
            setEditingMessageIndex(null)
            setEditContent("")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update message')
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
                    <div className={`text-xs text-muted-foreground ${message.role === 'user'
                        ? 'self-end'
                        : 'self-start'
                    }`}>
                        {message.role === 'user' ? 'You' : 'AI'}
                    </div>
                    <div
                        className={`break-words max-w-7/10 w-fit px-4 py-2 rounded-md text-sm font-medium shadow-xs bg-secondary text-secondary-foreground
                             ${message.role === 'user'
                                ? 'self-end'
                                : 'self-start'
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
                            <div className={`whitespace-pre-wrap ${message.role === 'user'
                                ? 'opacity-80'
                                : 'opacity-100'
                            }`}>{message.content}</div>
                        )}
                    </div>
                    {editingMessageIndex !== index && (
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${message.role === 'user'
                                ? 'self-end ml-auto'
                                : 'self-start mr-auto'
                            }`}>
                            <Button variant="ghost" size="sm" onClick={() => continueMessage(index)}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <ArrowRight className="h-4 w-4" />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" sideOffset={14}>
                                            Continue Message
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => startEditing(index)}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Edit3 className="h-4 w-4" />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" sideOffset={14}>
                                            Edit Message
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteMessage(index)}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Trash className="h-4 w-4" />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" sideOffset={14}>
                                            Delete Message
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
} 