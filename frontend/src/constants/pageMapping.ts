import InputPage from "@/pages/inputPage"
import LLMPage from "@/pages/llmPage"
import PipelineMonitorPage from "@/pages/pipelineMonitorPage"
import SettingsPage from "@/pages/settingsPage"
import TTSPage from "@/pages/ttsPage"
import { MessageCircleCode, Mic, Speech, SquareActivity, Settings } from "lucide-react"


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
    "pipeline-monitor": {
        page: PipelineMonitorPage,
        icon: SquareActivity,
        title: "Pipeline Monitor"
    },
    "settings": {
        page: SettingsPage,
        icon: Settings,
        title: "Settings"
    },
  }

export default pageMapping