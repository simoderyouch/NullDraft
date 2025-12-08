import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Camera, SkipForward } from 'lucide-react'

interface HUDData {
  currentStep: number
  totalSteps: number
  stepTitle: string
  stepDescription: string
}

export default function FloatingHUD() {
  const [hudData, setHudData] = useState<HUDData>({
    currentStep: 1,
    totalSteps: 8,
    stepTitle: 'Sample Step Title',
    stepDescription: 'This is a sample step description that will guide you through the capture process.',
  })

  useEffect(() => {

    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onHUDDataUpdate((data: HUDData) => {
        setHudData(data)
      })

      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeHUDDataListener()
        }
      }
    }
  }, [])

  const handleCapture = () => {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.captureScreenshot) {
      window.electronAPI.captureScreenshot()
    } else {
      console.log('Capture button clicked - screenshot functionality to be implemented')
    }
  }

  const handleSkip = () => {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.skipStep) {
      window.electronAPI.skipStep()
    } else {
      console.log('Skip button clicked - skip functionality to be implemented')
    }
  }

  return (
    <div className="fixed inset-0 flex items-center  justify-center pointer-events-none p-4">
      <Card className="glass-dark w-96 pointer-events-auto shadow-xl rounded-2xl border-white/20">
        <CardHeader className="pb-3 cursor-move" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white/90">
              Step {hudData.currentStep} of {hudData.totalSteps}
            </CardTitle>
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">
              {hudData.stepTitle}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed">
              {hudData.stepDescription}
            </p>
          </div>
          <div className="pt-2 border-t border-white/10">
            <div className="flex gap-2">
              <Button
                onClick={handleCapture}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                className="border-white/30 text-white hover:bg-white/10"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
            </div>
            <p className="text-xs text-white/50 text-center mt-3">
              Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Ctrl+Shift+S</kbd> to capture
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

