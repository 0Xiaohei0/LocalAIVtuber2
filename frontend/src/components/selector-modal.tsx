import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, Brain, Check } from "lucide-react"

interface AIModel {
  displayName: string
  description: string
  fileName: string
  link: string
  type: string
}

export default function AIModelSelector() {
    
const [open, setOpen] = useState(false)
  const [internalSelected, setInternalSelected] = useState<AIModel | null>(null)
  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/llm/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data.models || [])
        if (data.currentModel) {
          setInternalSelected(data.currentModel)
        }
        setLoading(false)
      })
  }, [])

  const handleModelSelect = (model: AIModel) => {
    setInternalSelected(model)
    fetch("/api/settings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { "llm.model_filename": model.fileName } }),
    })
    setOpen(false)
  }

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "text":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "image":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
      case "audio":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
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
          {models.map((model, index) => (
            <Card
              key={index}
              className={`cursor-pointer transition-all hover:shadow-md ${
                internalSelected?.displayName === model.displayName ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
              onClick={() => handleModelSelect(model)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{model.displayName}</CardTitle>
                      {internalSelected?.displayName === model.displayName && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <CardDescription className="text-sm">{model.description}</CardDescription>
                  </div>
                  <Badge className={getTypeColor(model.type)}>{model.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="font-mono">{model.fileName}</span>
                    <span>{}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(model.link, "_blank")
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)} disabled={!internalSelected}>
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
