"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Folder, Trash2, Download, AlertCircle, CheckCircle2, MoreVertical } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CharacterModel } from "@/lib/characterModels"

// Custom props for directory input
interface DirectoryInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string
  directory?: string
}

// Custom component for directory input
const DirectoryInput = React.forwardRef<HTMLInputElement, DirectoryInputProps>((props, ref) => {
  return <Input {...props} ref={ref} />;
});
DirectoryInput.displayName = "DirectoryInput";

interface Model extends CharacterModel {
  id: string
  type: "vrm" | "live2d"
  size: string
  uploadDate: string
  files?: string[]
}

interface ModelUploadManagerProps {
  live2DModels: CharacterModel[]
  vrmModels: CharacterModel[]
  onModelsChange?: () => void
}

export default function ModelUploadManager({ live2DModels, vrmModels, onModelsChange }: ModelUploadManagerProps) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Convert CharacterModels to internal Model format
  useEffect(() => {
    const convertedModels: Model[] = [
      ...live2DModels.map((model): Model => ({
        id: model.path,
        path: model.path,
        displayName: model.displayName,
        type: "live2d",
        size: "Unknown", // Size would need to be fetched from backend
        uploadDate: "Unknown", // Date would need to be fetched from backend
      })),
      ...vrmModels.map((model): Model => ({
        id: model.path,
        path: model.path,
        displayName: model.displayName,
        type: "vrm",
        size: "Unknown",
        uploadDate: "Unknown",
      })),
    ]
    setModels(convertedModels)
  }, [live2DModels, vrmModels])

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return

    setUploadStatus("uploading")

    try {
      const file = files[0]
      const formData = new FormData()
      formData.append("file", file)

      const endpoint = file.name.endsWith(".vrm") 
        ? "/api/character/vrm/upload"
        : "/api/character/live2d/upload"

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      setUploadStatus("success")
      onModelsChange?.()
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus("error")
    }

    setTimeout(() => setUploadStatus("idle"), 2000)
  }

  const handleFolderUpload = async (files: FileList | null) => {
    if (!files) return

    setUploadStatus("uploading")

    try {
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append("files", file, file.webkitRelativePath)
      })

      const response = await fetch("/api/character/live2d/upload-folder", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      setUploadStatus("success")
      onModelsChange?.()
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus("error")
    }

    setTimeout(() => setUploadStatus("idle"), 2000)
  }

  const handleDeleteModel = async (model: Model) => {
    try {
      const endpoint = model.type === "vrm"
        ? `/api/character/vrm/delete`
        : `/api/character/live2d/delete`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: model.path }),
      })

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`)
      }

      onModelsChange?.()
    } catch (error) {
      console.error("Delete error:", error)
    }
  }

  return (
    <div className="w-full">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="gap-2 w-full">
            <Upload className="h-4 w-4" />
            Manage Models
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] flex flex-col overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>3D Model Manager</DialogTitle>
            <DialogDescription>
              Upload .vrm files or Live2D model folders, and manage your existing models.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 w-full">
            {/* Upload Section */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-lg">Upload Models</CardTitle>
                <CardDescription>Support for .vrm files and Live2D model folders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Upload Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vrm-upload">VRM File Upload</Label>
                    <Button
                      variant="outline"
                      className="w-full gap-2 bg-transparent"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadStatus === "uploading"}
                    >
                      <FileText className="h-4 w-4" />
                      Select .vrm File
                    </Button>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".vrm"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="folder-upload">Live2D Folder Upload</Label>
                    <Button
                      variant="outline"
                      className="w-full gap-2 bg-transparent"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={uploadStatus === "uploading"}
                    >
                      <Folder className="h-4 w-4" />
                      Select Folder
                    </Button>
                    <DirectoryInput
                      ref={folderInputRef}
                      type="file"
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={(e) => handleFolderUpload(e.target.files)}
                    />
                  </div>
                </div>

                {/* Upload Status */}
                {uploadStatus !== "idle" && (
                  <Alert className={uploadStatus === "error" ? "border-destructive" : ""}>
                    {uploadStatus === "uploading" && <AlertCircle className="h-4 w-4" />}
                    {uploadStatus === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {uploadStatus === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    <AlertDescription>
                      {uploadStatus === "uploading" && "Uploading model..."}
                      {uploadStatus === "success" && "Model uploaded successfully!"}
                      {uploadStatus === "error" && "Upload failed. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Existing Models Section */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-lg">Existing Models ({models.length})</CardTitle>
                <CardDescription>Manage your uploaded 3D models</CardDescription>
              </CardHeader>
              <CardContent>
                {models.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No models uploaded yet</p>
                    <p className="text-sm">Upload your first model to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-md bg-primary/10">
                            {model.type === "vrm" ? (
                              <FileText className="h-5 w-5 text-primary" />
                            ) : (
                              <Folder className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{model.displayName}</h4>
                              <Badge variant={model.type === "vrm" ? "default" : "secondary"}>
                                {model.type.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2" onClick={() => window.open(`/api/character/${model.type}/download/${encodeURIComponent(model.path)}`)}>
                              <Download className="h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDeleteModel(model)}>
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
