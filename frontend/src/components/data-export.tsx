import { useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchSessionContent } from "@/lib/sessionManager"

interface ChatSession {
  id: string
  title: string
  date: Date
  messageCount: number
  duration: string
}

interface ChatExportModalProps {
  sessions: ChatSession[]
  trigger?: React.ReactNode
}

interface HistoryItem {
  role: "user" | "assistant"
  content: string
}

interface ShareGPTConversation {
  from: "human" | "gpt"
  value: string
}

interface ShareGPTFormat {
  conversations: ShareGPTConversation[]
}

// Function to create sliding windows for ShareGPT format
function createShareGPTSlidingWindows(
  history: HistoryItem[],
  windowSize: number,
  stride: number
): ShareGPTFormat[] {
  const result: ShareGPTFormat[] = []
  
  // Filter out empty messages and ensure proper alternating pattern
  const validHistory = history.filter(msg => msg.content && msg.content.trim())
  
  if (validHistory.length === 0) {
    return result
  }
  
  // Ensure alternating human-gpt pattern
  const alternatingHistory: HistoryItem[] = []
  let lastRole: string | null = null
  
  for (const msg of validHistory) {
    // Skip consecutive messages from the same role
    if (msg.role !== lastRole) {
      alternatingHistory.push(msg)
      lastRole = msg.role
    }
  }
  
  // Create sliding windows working with pairs
  // Each pair consists of a human message followed by a gpt message
  const pairs: HistoryItem[][] = []
  for (let i = 0; i < alternatingHistory.length - 1; i += 2) {
    if (alternatingHistory[i].role === "user" && alternatingHistory[i + 1].role === "assistant") {
      pairs.push([alternatingHistory[i], alternatingHistory[i + 1]])
    }
  }
  
  // Create sliding windows from pairs
  for (let i = 0; i < pairs.length; i += stride) {
    const windowEnd = Math.min(i + windowSize, pairs.length)
    const windowPairs = pairs.slice(i, windowEnd)
    
    // Skip if we don't have enough pairs
    if (windowPairs.length === 0) {
      continue
    }
    
    // Flatten pairs back to messages
    const window = windowPairs.flat()
    
    // Since we're working with complete pairs, the window should always be valid
    // (starts with human, ends with gpt, proper alternating pattern)
    
    // Convert to ShareGPT format
    const conversations: ShareGPTConversation[] = window.map(msg => ({
      from: msg.role === "user" ? "human" : "gpt",
      value: msg.content
    }))
    
    result.push({ conversations })
  }
  
  return result
}

// Function to download JSON file
function downloadJsonFile(data: ShareGPTFormat[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ChatExportModal({ sessions, trigger }: ChatExportModalProps) {
  const [open, setOpen] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState<"llama" | "sharegpt">("llama")
  const [windowSize, setWindowSize] = useState("5")
  const [stride, setStride] = useState("1")
  const [isExporting, setIsExporting] = useState(false)

  const handleSessionToggle = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId],
    )
  }

  const handleSelectAll = () => {
    if (selectedSessions.length === sessions.length) {
      setSelectedSessions([])
    } else {
      setSelectedSessions(sessions.map((session) => session.id))
    }
  }

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const exportData: ShareGPTFormat[] = []
      
      // Process each selected session
      for (const sessionId of selectedSessions) {
        try {
          // Fetch the full session data including history
          const sessionData = await fetchSessionContent(sessionId)
          
          if (!sessionData || !sessionData.history) {
            console.warn(`No history found for session ${sessionId}`)
            continue
          }

          const history: HistoryItem[] = sessionData.history
          
          if (exportFormat === "sharegpt") {
            // Create sliding windows for ShareGPT format
            const windows = createShareGPTSlidingWindows(
              history,
              Number.parseInt(windowSize),
              Number.parseInt(stride)
            )
            exportData.push(...windows)
          } else {
            // For llama format, just convert the messages
            const conversations: ShareGPTConversation[] = history
              .filter(msg => msg.content && msg.content.trim())
              .map(msg => ({
                from: msg.role === "user" ? "human" : "gpt",
                value: msg.content
              }))
            
            if (conversations.length > 0) {
              exportData.push({ conversations })
            }
          }
        } catch (error) {
          console.error(`Failed to export session ${sessionId}:`, error)
        }
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `chat_export_${exportFormat}_${timestamp}.json`
      
      // Download the file
      downloadJsonFile(exportData, filename)
      
      console.log(`Exported ${exportData.length} conversation${exportData.length !== 1 ? 's' : ''} in ${exportFormat} format`)
      
    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setIsExporting(false)
      setOpen(false)
      // Reset form
      setSelectedSessions([])
    }
  }

  const isAllSelected = selectedSessions.length === sessions.length && sessions.length > 0
  const isIndeterminate = selectedSessions.length > 0 && selectedSessions.length < sessions.length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export Chat Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Chat Data</DialogTitle>
          <DialogDescription>Select the sessions and export format for your chat data.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-hidden">
          {/* Session List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Chat Sessions ({sessions.length} found)</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) {
                      const checkbox = el as HTMLButtonElement & { indeterminate?: boolean }
                      checkbox.indeterminate = isIndeterminate
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm">
                  Select All
                </Label>
              </div>
            </div>

            <ScrollArea className="h-48 border rounded-md">
              <div className="p-4 space-y-3">
                {sessions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No sessions found</div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={session.id}
                        checked={selectedSessions.includes(session.id)}
                        onCheckedChange={() => handleSessionToggle(session.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={session.id} className="font-medium cursor-pointer">
                          {session.title}
                        </Label>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{session.date.toLocaleDateString()}</span>
                          <Badge variant="secondary" className="text-xs">
                            {session.messageCount} messages
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Export Format Options */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Export Format</Label>
            <Select value={exportFormat} onValueChange={(value: "llama" | "sharegpt") => setExportFormat(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llama">Llama Format</SelectItem>
                <SelectItem value="sharegpt">ShareGPT Format</SelectItem>
              </SelectContent>
            </Select>

            {/* ShareGPT Additional Options */}
            {exportFormat === "sharegpt" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="window-size" className="text-sm">
                      Sliding Window Size
                    </Label>
                    <Input
                      id="window-size"
                      type="number"
                      value={windowSize}
                      onChange={(e) => setWindowSize(e.target.value)}
                      placeholder="5"
                      min="2"
                      max="20"
                      step="1"
                    />
                    <p className="text-xs text-muted-foreground">Number of message pairs (human-gpt exchanges) in each training example</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stride" className="text-sm">
                      Stride
                    </Label>
                    <Input
                      id="stride"
                      type="number"
                      value={stride}
                      onChange={(e) => setStride(e.target.value)}
                      placeholder="1"
                      min="1"
                      max="10"
                      step="1"
                    />
                    <p className="text-xs text-muted-foreground">Number of message pairs to skip between training examples</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p><strong>Note:</strong> Each conversation will start with a human message and end with a GPT message. Empty messages will be filtered out.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={selectedSessions.length === 0 || isExporting} className="gap-2">
            {isExporting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export {selectedSessions.length} Session{selectedSessions.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
