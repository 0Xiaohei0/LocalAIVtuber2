import InputPage from "@/pages/inputPage"
import LLMPage from "@/pages/llmPage"
import PipelineMonitorPage from "@/pages/pipelineMonitorPage"
import SettingsPage from "@/pages/settingsPage"
import TTSPage from "@/pages/ttsPage"
import CharacterPage from "@/pages/characterPage"
import { MessageCircleCode, Mic, Speech, SquareActivity, Settings, User, Airplay } from "lucide-react"
import StreamPage from "@/pages/streamPage"


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
    "character": {
        page: CharacterPage,
        icon: User,
        title: "Character"
    },
    "settings": {
        page: SettingsPage,
        icon: Settings,
        title: "Settings"
    },
    "stream": {
        page: StreamPage,
        icon: Airplay,
        title: "stream"
    },
  }

export default pageMapping