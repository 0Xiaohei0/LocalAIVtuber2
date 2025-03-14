import './App.css'
import { ThemeProvider } from "@/components/theme-provider"
import Mainpage from './pages/mainpage'

function App() {

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Mainpage />
    </ThemeProvider>
  )
}

export default App
