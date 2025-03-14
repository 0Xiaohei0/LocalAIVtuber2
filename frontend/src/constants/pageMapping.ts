import InputPage from "@/pages/inputPage"
import LLMPage from "@/pages/llmPage"
import MemoryPage from "@/pages/memoryPage"
import PipelineMonitorPage from "@/pages/pipelineMonitorPage"
import TTSPage from "@/pages/ttsPage"
import { MessageCircleCode, Mic, Speech, Database, SquareActivity } from "lucide-react"


const pageMapping = {
    "input": {
        page: InputPage,
        icon: Mic,
        title: "Input"
    },
    "llm": {
        page: LLMPage,
        icon: MessageCircleCode,
        title: "LLM"
    },
    "tts": {
        page: TTSPage,
        icon: Speech,
        title: "TTS"
    },
    "memory": {
        page: MemoryPage,
        icon: Database,
        title: "Memory"
    },
    "pipeline-monitor": {
        page: PipelineMonitorPage,
        icon: SquareActivity,
        title: "Pipeline Monitor"
    },
  }

export default pageMapping