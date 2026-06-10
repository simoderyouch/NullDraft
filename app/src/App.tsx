import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CreateProject from './pages/CreateProject'
import EditProject from './pages/EditProject'
import Review from './pages/Review'
import Capture from './pages/Capture'
import Export from './pages/Export'
import Annotate from './pages/Annotate'
import EnhanceDocument from './pages/EnhanceDocument'
import Settings from './pages/Settings'
import FloatingHUD from './components/FloatingHUD'
import { Button } from './components/ui/button'
import { ToastProvider } from './components/ui/toast'
import { X, Minus } from 'lucide-react'

function App() {

  useEffect(() => {
    async function applyTheme() {
      try {
        if (window.electronAPI?.getConfig) {
          const cfg = await window.electronAPI.getConfig()
          document.documentElement.classList.toggle('dark', !!cfg.darkMode)
        }
      } catch {
        // ignore
      }
    }
    applyTheme()
  }, [])

  const isHUDWindow = window.location.hash === '#/hud'

  if (isHUDWindow) {
    return <FloatingHUD />
  }

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      if (window.electronAPI && window.electronAPI.closeWindow) {
        window.electronAPI.closeWindow().catch(console.error)
      } else {

        window.close()
      }
    }
  }

  const handleHide = () => {
    if (typeof window !== 'undefined') {
      if (window.electronAPI && window.electronAPI.minimizeWindow) {
        window.electronAPI.minimizeWindow().catch(console.error)
      }
    }

  }

  return (
    <BrowserRouter>
      <ToastProvider>
      <div className="min-h-screen relative " >
        {/* Drag Region */}
        <div className="absolute top-0 !cursor-grab left-0 right-0 h-[4rem] z-40" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

        <div className="absolute top-4 right-4 z-50 flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
          <Route path="/create" element={<CreateProject />} />
          <Route path="/edit" element={<EditProject />} />
          <Route path="/review" element={<Review />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/export" element={<Export />} />
          <Route path="/annotate" element={<Annotate />} />
          <Route path="/enhance" element={<EnhanceDocument />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App

