import { useEffect, useState } from "react"
import { ArrowLeft, Edit3, Save, X, Code, User, Bot, Calendar, Database } from "lucide-react"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader } from "../components/ui/card"
import { Textarea } from "../components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"

interface Message {
  role: string
  content: string
}

interface Session {
  id: string
  title: string
  created_at: string
  history: Message[]
  indexed?: boolean
}

interface ImportedMessage {
  role: string
  content: string
  id?: string
  timestamp?: string
}

interface SessionDetailProps {
  sessionId: string
  onBack: () => void
}

export default function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  const [sessionData, setSessionData] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null)
  const [editContent, setEditContent] = useState("")
  const [jsonContent, setJsonContent] = useState("")
  const [activeTab, setActiveTab] = useState("chat")

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/chat/session/${sessionId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch session')
        }
        const data = await response.json()
        setSessionData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Session not found</h1>
          <Button onClick={onBack}>Back to Sessions</Button>
        </div>
      </div>
    )
  }

  const startEditing = (index: number) => {
    setEditingMessageIndex(index)
    setEditContent(sessionData.history[index].content)
  }

  const saveEdit = async () => {
    if (editingMessageIndex === null) return

    try {
      const updatedHistory = [...sessionData.history]
      updatedHistory[editingMessageIndex] = {
        ...updatedHistory[editingMessageIndex],
        content: editContent
      }

      const response = await fetch(`/api/chat/session/${sessionData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: updatedHistory
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update message')
      }

      setSessionData({
        ...sessionData,
        history: updatedHistory
      })
      setEditingMessageIndex(null)
      setEditContent("")
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message')
    }
  }

  const cancelEdit = () => {
    setEditingMessageIndex(null)
    setEditContent("")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const exportToJson = () => {
    const jsonData = {
      session: {
        id: sessionData.id,
        title: sessionData.title,
        createdAt: sessionData.created_at,
        indexed: sessionData.indexed,
      },
      messages: sessionData.history.map((msg, index) => ({
        id: `m${index + 1}`,
        ...msg,
        timestamp: sessionData.created_at // Using created_at as timestamp for now
      })),
    }
    setJsonContent(JSON.stringify(jsonData, null, 2))
  }

  const importFromJson = async () => {
    try {
      const parsed = JSON.parse(jsonContent)
      if (parsed.messages && Array.isArray(parsed.messages)) {
        const response = await fetch(`/api/chat/session/${sessionData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            history: parsed.messages.map((msg: ImportedMessage) => ({
              role: msg.role,
              content: msg.content
            }))
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to import messages')
        }

        setSessionData({
          ...sessionData,
          history: parsed.messages.map((msg: ImportedMessage) => ({
            role: msg.role,
            content: msg.content
          }))
        })
      }
    } catch (err) {
      console.error("Invalid JSON format or import failed", err)
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" className="mb-4" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>

          <div className="rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">{sessionData.title}</h1>
              <Badge variant={sessionData.indexed ? "default" : "secondary"}>
                {sessionData.indexed ? "Indexed" : "Not Indexed"}
              </Badge>
            </div>

            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Created: {formatDate(sessionData.created_at)}
              </div>
              <div className="flex items-center">
                <Database className="h-4 w-4 mr-2" />
                Messages: {sessionData.history.length}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat">Chat History</TabsTrigger>
            <TabsTrigger value="json">JSON Editor</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            {sessionData.history.map((message, index) => (
              <Card key={index} className={`${message.role === "user" ? "ml-12" : "mr-12"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {message.role === "user" ? (
                        <User className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Bot className="h-5 w-5 text-green-600" />
                      )}
                      <span className="font-medium capitalize">{message.role}</span>
                      <span className="text-sm text-gray-500">{formatDate(sessionData.created_at)}</span>
                    </div>

                    {editingMessageIndex !== index && (
                      <Button variant="ghost" size="sm" onClick={() => startEditing(index)}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
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
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="json" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">JSON Editor</h3>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={exportToJson}>
                      <Code className="h-4 w-4 mr-2" />
                      Export to JSON
                    </Button>
                    <Button onClick={importFromJson}>
                      <Save className="h-4 w-4 mr-2" />
                      Import from JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={jsonContent}
                  onChange={(e) => setJsonContent(e.target.value)}
                  placeholder="Click 'Export to JSON' to see the current session data, or paste JSON here to import"
                  className="min-h-96 font-mono text-sm"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 