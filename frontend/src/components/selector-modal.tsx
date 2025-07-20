import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, Brain, Check, RefreshCw, AlertCircle, Trash2 } from "lucide-react"

interface AIModel {
  displayName: string
  description: string
  fileName: string
  link: string
  type: string
  file_exists?: boolean
  file_size_readable?: string
  model_folder?: string
}

interface DownloadProgress {
  model_name: string
  status: 'starting' | 'downloading' | 'completed' | 'error' | 'cancelled'
  progress: number
  total_size: number
  downloaded_size: number
  error?: string
  download_speed?: string
  elapsed_time?: number
}

export default function AIModelSelector() {
    
const [open, setOpen] = useState(false)
  const [internalSelected, setInternalSelected] = useState<AIModel | null>(null)
  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<Record<string, string>>({}) // modelName -> downloadId
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({})

  const loadModels = async () => {
    try {
      const res = await fetch("/api/llm/models")
      const data = await res.json()
      setModels(data.models || [])
      if (data.currentModel) {
        setInternalSelected(data.currentModel)
      }
      setLoading(false)
    } catch (error) {
      console.error("Failed to load models:", error)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  // Poll for download progress
  useEffect(() => {
    const pollProgress = async () => {
      for (const [modelName, downloadId] of Object.entries(downloading)) {
        try {
          const res = await fetch(`/api/llm/models/download/${downloadId}/progress`)
          if (res.ok) {
            const progress = await res.json()
            setDownloadProgress(prev => ({
              ...prev,
              [modelName]: progress
            }))
            
            // If download completed or failed, remove from downloading list and refresh models
            if (progress.status === 'completed' || progress.status === 'error') {
              setDownloading(prev => {
                const newDownloading = { ...prev }
                delete newDownloading[modelName]
                return newDownloading
              })
              
              if (progress.status === 'completed') {
                await loadModels() // Refresh model list to show updated file status
              }
            }
          }
        } catch (error) {
          console.error(`Failed to get progress for ${downloadId}:`, error)
        }
      }
    }

    if (Object.keys(downloading).length > 0) {
      const interval = setInterval(pollProgress, 1000)
      return () => clearInterval(interval)
    }
  }, [downloading])

  const handleModelSelect = (model: AIModel) => {
    setInternalSelected(model)
    fetch("/api/settings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { "llm.model_filename": model.fileName } }),
    })
    setOpen(false)
  }

  const handleDownload = async (model: AIModel) => {
    try {
      const res = await fetch("/api/llm/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: model.displayName
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        setDownloading(prev => ({
          ...prev,
          [model.fileName]: data.download_id
        }))
        setDownloadProgress(prev => ({
          ...prev,
          [model.fileName]: {
            model_name: model.fileName,
            status: 'starting',
            progress: 0,
            total_size: 0,
            downloaded_size: 0
          }
        }))
      } else {
        alert(`Download failed: ${data.error}`)
      }
    } catch (error) {
      console.error("Download failed:", error)
      alert("Download failed: Network error")
    }
  }

  const handleDelete = async (model: AIModel) => {
    if (!confirm(`Are you sure you want to delete ${model.displayName}?`)) {
      return
    }
    
    try {
      const res = await fetch("/api/llm/models/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: model.displayName
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        await loadModels() // Refresh model list to show updated file status
        
        // If we deleted the currently selected model, clear the selection
        if (internalSelected?.displayName === model.displayName) {
          setInternalSelected(null)
        }
      } else {
        alert(`Delete failed: ${data.error}`)
      }
    } catch (error) {
      console.error("Delete failed:", error)
      alert("Delete failed: Network error")
    }
  }



  const getStatusBadge = (model: AIModel) => {
    const isDownloading = model.fileName in downloading
    const progress = downloadProgress[model.fileName]

    if (isDownloading && progress) {
      if (progress.status === 'error') {
        return <Badge variant="destructive" className="ml-auto">Download Failed</Badge>
      } else if (progress.status === 'completed') {
        return <Badge variant="default" className="ml-aut">Downloaded</Badge>
      } else {
        return <Badge variant="secondary" className="ml-auto">Downloading...</Badge>
      }
    }

    if (model.file_exists) {
      return <Badge variant="default" className="ml-auto">Downloaded</Badge>
    } else {
      return <Badge variant="outline" className="ml-auto">Not Downloaded</Badge>
    }
  }

  if (loading) return <div>Loading models...</div>

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full overflow-hidden text-ellipsis justify-start">
          <Brain className="mr-2 h-4 w-4" />
          {internalSelected ? internalSelected.displayName : "Select AI Model"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Select AI Model
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {models.map((model, index) => {
            const isDownloading = model.fileName in downloading
            const progress = downloadProgress[model.fileName]
            
            return (
              <Card
                key={index}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  internalSelected?.displayName === model.displayName ? "ring-2 ring-primary bg-primary/5" : ""
                }`}
                onClick={() => model.file_exists && handleModelSelect(model)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{model.displayName}</CardTitle>
                        {internalSelected?.displayName === model.displayName && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        {getStatusBadge(model)}
                      </div>
                      <CardDescription className="text-sm">{model.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-6">
                        <span className="font-mono whitespace-nowrap overflow-hidden text-ellipsis w-40">{model.fileName}</span>
                        <span className="font-medium shrink-0">
                          {model.file_size_readable || 'Unknown size'}
                        </span>
                      </div>
                      
                      {/* Download Progress */}
                      {isDownloading && progress && progress.status !== 'error' && (
                        <div className="flex items-center gap-2">
                          {progress.status === 'downloading' && (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          )}
                          <span className="text-xs">
                            {progress.status === 'starting' && 'Starting...'}
                            {progress.status === 'downloading' && `${Math.round(progress.progress)}%`}
                            {progress.status === 'completed' && 'Complete'}
                          </span>
                        </div>
                      )}
                      
                      {/* Error indicator */}
                      {progress?.status === 'error' && (
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          <span className="text-xs">Failed</span>
                        </div>
                      )}
                      
                                             {/* Download/Delete Button */}
                       {!isDownloading && !model.file_exists && (
                         <Button
                           variant="ghost"
                           size="sm"
                           className="h-8 px-2"
                           onClick={(e) => {
                             e.stopPropagation()
                             handleDownload(model)
                           }}
                         >
                           <Download className="h-3 w-3 mr-1" />
                           Download
                         </Button>
                       )}
                       
                       {!isDownloading && model.file_exists && (
                         <Button
                           variant="outline"
                           size="sm"
                           className="h-8 px-2"
                           onClick={(e) => {
                             e.stopPropagation()
                             handleDelete(model)
                           }}
                         >
                           <Trash2 className="h-3 w-3 mr-1" />
                           Delete
                         </Button>
                       )}
                    </div>
                    
                                         {/* Progress Bar */}
                     {isDownloading && progress && progress.status === 'downloading' && (
                       <div className="space-y-1">
                         <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
                           <div
                             className="h-full bg-primary transition-all"
                             style={{ width: `${progress.progress || 0}%` }}
                           />
                         </div>
                         <div className="flex justify-between text-xs text-muted-foreground">
                           <span>
                             {progress.download_speed || 'Calculating speed...'}
                           </span>
                           <span>
                             {Math.round(progress.progress)}% completed
                           </span>
                         </div>
                       </div>
                     )}
                    
                    {/* Error Message */}
                    {progress?.status === 'error' && (
                      <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        Error: {progress.error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => setOpen(false)} 
            disabled={!internalSelected || !internalSelected.file_exists}
          >
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
