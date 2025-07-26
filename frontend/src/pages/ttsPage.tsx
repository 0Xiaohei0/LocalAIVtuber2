import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Download, Settings, Mic, Volume2 } from "lucide-react"
import AudioPlayer from "@/components/audio-player"
import { pipelineManager } from "@/lib/pipelineManager"
import { globalStateManager } from "@/lib/globalStateManager"

type TTSProvider = "gpt-sovits" | "rvc"

export default function TTSPage() {
  const [selectedProvider, setSelectedProvider] = useState<TTSProvider>("gpt-sovits")
  const [text, setText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [voices, setVoices] = useState<string[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>("leaf")

  const abortControllerRef = useRef<AbortController | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isProcessingRef = useRef(false)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const handlePipelineUpdate = () => {
      processNextTTS()
      processNextAudio()
    }

    const unsubscribe = pipelineManager.subscribe(handlePipelineUpdate)
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    fetchVoices()
  }, [])

  const analyzeAudio = (audio: HTMLAudioElement) => {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaElementSource(audio)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)
    analyser.connect(audioContext.destination)

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray)
      const avgVolume = dataArray.reduce((a, b) => a + b, 0)
      const normalizedVolume = avgVolume / 15096
      globalStateManager.updateState("ttsLiveVolume", normalizedVolume)
      if (!audio.paused) {
        requestAnimationFrame(updateVolume)
      }
    }

    updateVolume()
  }

  const fetchVoices = async () => {
    const response = await fetch('/api/tts/voices')
    const data = await response.json()
    if (data.voices) {
      setVoices(data.voices)
      if (data.current_voice) {
        setSelectedVoice(data.current_voice)
      }
    }
  }

  const handleVoiceChange = async (voice: string) => {
    try {
      const response = await fetch('/api/tts/change-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ voice_name: voice })
      })
      const data = await response.json()
      if (response.ok) {
        setSelectedVoice(voice)
      } else {
        console.error(data.error || 'Failed to change voice')
      }
    } catch (error) {
      console.error('Failed to change voice:', error)
    }
  }

  const generateAudioFromText = async (text: string): Promise<string> => {
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: abortController.signal
    })

    if (!response.ok) {
      throw new Error("TTS generation failed")
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  const handleGenerate = async () => {
    if (!text.trim()) return

    setIsGenerating(true)
    setAudioUrl(null)

    try {
      const url = await generateAudioFromText(text)
      setAudioUrl(url)
      const audio = new Audio(url)
      audio.play()
    } catch (error) {
      console.error("Error fetching TTS audio:", error)
      alert("Failed to generate audio. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const processNextTTS = async () => {
    const currentTask = pipelineManager.getCurrentTask()
    if (currentTask?.status == "pending_interruption" && !currentTask.interruptionState?.tts) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isProcessingRef.current = false
      pipelineManager.markInterruptionState("tts")
      return
    }
    
    if (isProcessingRef.current) return

    const next = pipelineManager.getNextTaskForTTS()
    if (!next) return

    const { taskId, responseIndex, task } = next
    const textToSpeak = task.response[responseIndex].text

    isProcessingRef.current = true

    try {
      const audioUrl = await generateAudioFromText(textToSpeak)
      pipelineManager.addTTSAudio(taskId, responseIndex, audioUrl)
      isProcessingRef.current = false
    } catch (err) {
      console.error("TTS pipeline error:", err)
      isProcessingRef.current = false
    }
  }

  const processNextAudio = async () => {
    const currentTask = pipelineManager.getCurrentTask()
    if (currentTask?.status == "pending_interruption" && !currentTask.interruptionState?.audio) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
        currentAudioRef.current = null
      }
      isPlayingRef.current = false
      pipelineManager.markInterruptionState("audio")
      return
    }

    if (isPlayingRef.current) return

    const next = pipelineManager.getNextTaskForAudio()
    if (!next) return

    const { taskId, responseIndex, task } = next

    const audioUrl = task.response[responseIndex].audio
    isPlayingRef.current = true

    const audio = new Audio(audioUrl!)
    currentAudioRef.current = audio
    audio.play()
    analyzeAudio(audio)

    audio.onended = () => {
      isPlayingRef.current = false
      currentAudioRef.current = null
      pipelineManager.markPlaybackFinished(taskId, responseIndex)
    }
  }

  const handleDownload = () => {
    if (!audioUrl) return
    
    // Create an anchor element and trigger download
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = `tts-output-${Date.now()}.wav` // Give a unique filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Provider Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              TTS Provider Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedProvider} onValueChange={(value: TTSProvider) => setSelectedProvider(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select TTS Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-sovits">GPT-SoVITS</SelectItem>
                <SelectItem value="rvc">RVC (Real-time Voice Conversion)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Text Input and Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Text Input & Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-input">Text to synthesize</Label>
              <Textarea
                id="text-input"
                placeholder="Enter the text you want to convert to speech..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <div className="text-sm text-slate-500">{text.length} characters</div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleGenerate} disabled={!text.trim() || isGenerating} className="flex-1">
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Generate Speech
                  </>
                )}
              </Button>

              <Button variant="outline" disabled={!audioUrl} onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Audio Preview */}
            <div className="bg-accent rounded-lg p-4">
              {!audioUrl ? (
                <div className="text-center ">
                  Audio preview will appear here after generation
                </div>
              ) : (
                <AudioPlayer audioUrl={audioUrl} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Provider-specific Settings */}
        {selectedProvider === "gpt-sovits" && (
          <Card>
            <CardHeader>
              <CardTitle>GPT-SoVITS Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Voice Selection */}
              <div className="space-y-2">
                <Label>Voice Model</Label>
                <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice) => (
                      <SelectItem key={voice} value={voice}>
                        {voice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedProvider === "rvc" && (
          <Card>
            <CardHeader>
              <CardTitle>RVC Settings</CardTitle>
              <CardDescription>Configure Real-time Voice Conversion parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500">RVC settings coming soon...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}