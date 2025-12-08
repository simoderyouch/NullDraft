import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Review from './pages/Review'
import Capture from './pages/Capture'
import Export from './pages/Export'
import Settings from './pages/Settings'
import FloatingHUD from './components/FloatingHUD'
import { Button } from './components/ui/button'
import { X, Minus } from 'lucide-react'

function App() {
  // Check if we're in the HUD window (via hash)
  const isHUDWindow = window.location.hash === '#/hud'

  if (isHUDWindow) {
    return <FloatingHUD />
  }

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      if (window.electronAPI && window.electronAPI.closeWindow) {
        window.electronAPI.closeWindow().catch(console.error)
      } else {
        // Fallback: try direct window close
        window.close()
      }
    }
  }

  const handleHide = () => {
    if (typeof window !== 'undefined') {
      if (window.electronAPI && window.electronAPI.hideWindow) {
        window.electronAPI.hideWindow().catch(console.error)
      }
    }
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen relative bg-gray-900/20">
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleHide()
            }}
            className="h-8 w-8 rounded-full hover:bg-muted/50 hover:text-foreground text-foreground"
            type="button"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleClose()
            }}
            className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive text-foreground"
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/review" element={<Review />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/export" element={<Export />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App

