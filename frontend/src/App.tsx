import './App.css'
import { ThemeProvider } from "@/components/theme-provider"
import Mainpage from './pages/mainpage'
import { Toaster } from "@/components/ui/sonner"

function App() {

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Mainpage />
      <Toaster />
    </ThemeProvider>
  )
}

export default App
