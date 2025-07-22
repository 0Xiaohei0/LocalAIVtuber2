import { useEffect, useState, useRef } from "react"
import { ArrowLeft, Calendar, Database } from "lucide-react"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader } from "../components/ui/card"
import { Textarea } from "../components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import EditableChatHistory from "./editable-chat-history"
import { Session } from "@/lib/types"
import { fetchSessionContent } from "@/lib/sessionManager"

interface ImportedMessage {
  role: string
  content: string
  id?: string
  timestamp?: string
}

interface IndexedChunk {
  text: string;
  metadata?: Record<string, unknown>;
}

interface SessionDetailProps {
  sessionId: string
  onBack: () => void
}

export default function SessionDetail({ sessionId, onBack }: SessionDetailProps) {
  const [sessionData, setSessionData] = useState<Session | null>(null)
  const [jsonContent, setJsonContent] = useState("")
  const [activeTab, setActiveTab] = useState("chat")
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [indexedChunks, setIndexedChunks] = useState<IndexedChunk[] | null>(null)
  const [indexedLoading, setIndexedLoading] = useState(false)
  const [indexedError, setIndexedError] = useState<string | null>(null)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchSession = async () => {
      const session = await fetchSessionContent(sessionId)
      setSessionData(session)
    }
    fetchSession()
  }, [sessionId])

  // Auto-export JSON when switching to JSON tab
  useEffect(() => {
    if (activeTab === "json" && sessionData) {
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
      setJsonError(null)
    }
  }, [activeTab, sessionData])

  // Fetch indexed data when Indexed Data tab is selected
  useEffect(() => {
    if (activeTab === "indexed") {
      setIndexedLoading(true)
      setIndexedError(null)
      setIndexedChunks(null)
      fetch(`/api/chat/session/${sessionId}/indexed`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch indexed data")
          const data = await res.json()
          setIndexedChunks(data.chunks)
        })
        .catch((err) => {
          setIndexedError(err.message || "Failed to fetch indexed data")
        })
        .finally(() => setIndexedLoading(false))
    }
  }, [activeTab, sessionId])

  // Debounced auto-import as user edits JSON
  useEffect(() => {
    if (activeTab !== "json") return
    if (!sessionData) return
    if (!jsonContent) return
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    debounceTimeout.current = setTimeout(async () => {
      try {
        const parsed = JSON.parse(jsonContent)
        if (parsed.messages && Array.isArray(parsed.messages)) {
          // Only update if the new history is different
          const newHistory = parsed.messages.map((msg: ImportedMessage) => ({
            role: msg.role,
            content: msg.content
          }))
          const currentHistory = sessionData.history.map((msg) => ({
            role: msg.role,
            content: msg.content
          }))
          if (JSON.stringify(newHistory) === JSON.stringify(currentHistory)) {
            setJsonError(null)
            return
          }
          const response = await fetch("/api/chat/session/update", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              session_id: sessionData.id,
              history: newHistory
            }),
          })
          if (!response.ok) {
            setJsonError('Failed to import messages')
            return
          }
          setSessionData({
            ...sessionData,
            history: newHistory
          })
          setJsonError(null)
        }
      } catch {
        setJsonError("Invalid JSON format or import failed")
      }
    }, 500)
    // Cleanup on unmount or content change
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [jsonContent, activeTab, sessionData])

  if (!sessionData) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Session not found</h1>
          <Button onClick={onBack}>Back to Sessions</Button>
        </div>
      </div>
    )
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat">Chat History</TabsTrigger>
            <TabsTrigger value="json">JSON Editor</TabsTrigger>
            <TabsTrigger value="indexed">Indexed Data</TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <Card className="p-4">
              <EditableChatHistory 
                messages={sessionData.history}
                sessionId={sessionData.id}
                onContinue={() => {}}
                onRegenerate={() => {}}
                onUpdate={(updatedHistory) => {
                  setSessionData(prev => prev ? {
                    ...prev,
                    history: updatedHistory
                  } : null)
                }}
              />
            </Card>
          </TabsContent>

          <TabsContent value="json" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">JSON Editor</h3>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={jsonContent}
                  onChange={(e) => setJsonContent(e.target.value)}
                  placeholder="Session data in JSON format. Edit to update session."
                  className="min-h-96 font-mono text-sm"
                />
                {jsonError && (
                  <div className="text-red-500 mt-2">{jsonError}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indexed" className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Indexed Data</h3>
              </CardHeader>
              <CardContent>
                {indexedLoading && <div>Loading indexed data...</div>}
                {indexedError && <div className="text-red-500">{indexedError}</div>}
                {indexedChunks && indexedChunks.length === 0 && <div>No indexed data found for this session.</div>}
                {indexedChunks && indexedChunks.length > 0 && (
                  <div className="space-y-4">
                    {[...indexedChunks]
                      .sort((a, b) => {
                        const aIdx = typeof a.metadata?.chunk_index === 'number' ? a.metadata.chunk_index : 0;
                        const bIdx = typeof b.metadata?.chunk_index === 'number' ? b.metadata.chunk_index : 0;
                        return aIdx - bIdx;
                      })
                      .map((chunk, idx) => (
                        <div key={idx} className="p-3 border rounded bg-muted">
                          <div className="font-mono text-sm whitespace-pre-wrap">{chunk.text}</div>
                          {chunk.metadata && typeof chunk.metadata.chunk_index === 'number' && (
                            <div className="text-xs text-gray-500 mt-1">Chunk #{(chunk.metadata.chunk_index as number) + 1}</div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 