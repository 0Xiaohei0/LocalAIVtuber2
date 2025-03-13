import './App.css'
import Chatbox from './components/chatbox'
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from './components/mode-toggle'

function App() {

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Chatbox></Chatbox>
      <ModeToggle></ModeToggle>
    </ThemeProvider>
  )
}

export default App
