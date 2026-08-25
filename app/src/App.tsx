import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CreateProject from './pages/CreateProject'
import EditProject from './pages/EditProject'
import Review from './pages/Review'
import Capture from './pages/Capture'
import Export from './pages/Export'
import Annotate from './pages/Annotate'
import EnhanceDocument from './pages/EnhanceDocument'
import Settings from './pages/Settings'
import Auth from './pages/Auth'
import FloatingHUD from './components/FloatingHUD'
import { Button } from './components/ui/button'
import { ToastProvider } from './components/ui/toast'
import { X, Minus } from 'lucide-react'

function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
    }),
  ])
}

/**
 * The standard edition is local-first.  A distributor can opt into the
 * invite-only edition with NULLDRAFT_REQUIRE_CLOUD_ACCESS=1; only that edition
 * requires a live cloud account before opening the workspace.
 */
function RequireCloudAccess({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [isReady, setIsReady] = useState(false)
  const [isRequired, setIsRequired] = useState(false)
  const [hasAccount, setHasAccount] = useState(false)

  useEffect(() => {
    let active = true
    const verifyAccess = async () => {
      try {
        const cfg = await withTimeout(window.electronAPI.getConfig())
        const cloudRequired = Boolean(cfg.requireCloudAccess)
        if (active) setIsRequired(cloudRequired)
        if (!cloudRequired) {
          if (active) setHasAccount(true)
          return
        }
        if (!cfg.cloudAccessToken) {
          if (active) setHasAccount(false)
          return
        }
        // A hosted service can take a few seconds to wake up. Do not discard a
        // valid saved session just because the first cloud check is slower than
        // local configuration reads.
        const status = await withTimeout(window.electronAPI.getCloudAccountStatus(), 15_000)
        if (active) setHasAccount(Boolean(status.connected && status.user))
      } catch {
        if (active) setHasAccount(false)
      } finally {
        if (active) setIsReady(true)
      }
    }

    verifyAccess()
    const interval = window.setInterval(verifyAccess, 30 * 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [location.pathname])

  if (!isReady) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>
  if (isRequired && !hasAccount) return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function App() {

  useEffect(() => {
    async function applyTheme() {
      try {
        if (window.electronAPI?.getConfig) {
          const cfg = await window.electronAPI.getConfig()
          document.documentElement.classList.add('dark')
          const backgroundOpacity = Math.max(0, Math.min(100, cfg.backgroundOpacity ?? 70))
          document.documentElement.style.setProperty('--app-background-opacity', String(backgroundOpacity / 100))
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
    <HashRouter>
      <ToastProvider>
      <div className="app-shell relative" >
        {/* Drag Region */}
        <div className="absolute top-0 !cursor-grab left-0 right-0 h-4 z-40" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

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
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<RequireCloudAccess><Dashboard /></RequireCloudAccess>} />
          <Route path="/create" element={<RequireCloudAccess><CreateProject /></RequireCloudAccess>} />
          <Route path="/edit" element={<RequireCloudAccess><EditProject /></RequireCloudAccess>} />
          <Route path="/review" element={<RequireCloudAccess><Review /></RequireCloudAccess>} />
          <Route path="/capture" element={<RequireCloudAccess><Capture /></RequireCloudAccess>} />
          <Route path="/export" element={<RequireCloudAccess><Export /></RequireCloudAccess>} />
          <Route path="/annotate" element={<RequireCloudAccess><Annotate /></RequireCloudAccess>} />
          <Route path="/enhance" element={<RequireCloudAccess><EnhanceDocument /></RequireCloudAccess>} />
          <Route path="/settings" element={<RequireCloudAccess><Settings /></RequireCloudAccess>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      </ToastProvider>
    </HashRouter>
  )
}

export default App
