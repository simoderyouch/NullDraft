import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Camera, ArrowRight, ArrowLeft, Check, Loader2, CheckCircle2 } from 'lucide-react'

interface StepData {
  id: string
  number: number
  title: string
  description: string
  imagePath: string | null
  skipped: boolean
}

interface HUDData {
  currentStep: number
  totalSteps: number
  stepTitle: string
  stepDescription: string
  projectPath?: string
  stepNumber?: number
  steps?: StepData[]
}

type CaptureStatus = 'idle' | 'capturing' | 'success' | 'error'

export default function FloatingHUD() {
  const [hudData, setHudData] = useState<HUDData>({
    currentStep: 1,
    totalSteps: 1,
    stepTitle: 'Waiting for project...',
    stepDescription: 'Start capture from the Review page.',
  })
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('idle')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // Get active (non-skipped) steps
  const activeSteps = hudData.steps?.filter(s => !s.skipped) || []
  const currentStep = activeSteps[currentStepIndex]

  // Advance to next step
  const advanceStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex >= activeSteps.length) {
      // All steps complete
      setIsComplete(true)
      console.log('All steps captured!')
    } else {
      setCurrentStepIndex(nextIndex)
      const nextStep = activeSteps[nextIndex]
      if (nextStep) {
        setHudData(prev => ({
          ...prev,
          currentStep: nextIndex + 1,
          stepTitle: nextStep.title,
          stepDescription: nextStep.description,
          stepNumber: nextStep.number,
        }))
      }
    }
  }, [currentStepIndex, activeSteps])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onHUDDataUpdate((data: HUDData) => {
        setHudData(data)
        setCurrentStepIndex(data.currentStep - 1)
        setIsComplete(false)
      })

      window.electronAPI.onCaptureSuccess(() => {
        setCaptureStatus('success')
        // Auto-advance after showing success
        setTimeout(() => {
          setCaptureStatus('idle')
          advanceStep()
        }, 800)
      })

      window.electronAPI.onStepSkipped(() => {
        advanceStep()
      })

      window.electronAPI.onStepBack(() => {
        if (currentStepIndex > 0) {
          const prevIndex = currentStepIndex - 1
          setCurrentStepIndex(prevIndex)
          const prevStep = activeSteps[prevIndex]
          if (prevStep) {
            setHudData(prev => ({
              ...prev,
              currentStep: prevIndex + 1,
              stepTitle: prevStep.title,
              stepDescription: prevStep.description,
              stepNumber: prevStep.number,
            }))
          }
        }
      })

      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeHUDDataListener()
          window.electronAPI.removeCaptureSuccessListener()
          window.electronAPI.removeStepSkippedListener()
          window.electronAPI.removeStepBackListener()
        }
      }
    }
  }, [advanceStep, currentStepIndex, activeSteps])

  useEffect(() => {
    // Set body background to transparent for the HUD window
    const originalBackground = document.body.style.background
    document.body.style.background = 'transparent'

    return () => {
      document.body.style.background = originalBackground
    }
  }, [])

  const handleCapture = async () => {
    if (captureStatus === 'capturing' || !currentStep) return

    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.captureScreenshot) {
      setCaptureStatus('capturing')
      try {
        // Pass step info to capture with step-based naming
        const stepInfo = hudData.projectPath ? {
          projectPath: hudData.projectPath,
          stepNumber: currentStep.number,
          stepTitle: currentStep.title,
        } : undefined

        const result = await window.electronAPI.captureScreenshot(stepInfo)
        if (result.success) {
          console.log('Screenshot saved:', result.filename)
          // Success feedback and advance handled by onCaptureSuccess listener
        } else {
          setCaptureStatus('error')
          setTimeout(() => setCaptureStatus('idle'), 2000)
          console.error('Capture failed:', result.error)
        }
      } catch (error) {
        setCaptureStatus('error')
        setTimeout(() => setCaptureStatus('idle'), 2000)
        console.error('Capture error:', error)
      }
    }
  }

  const handleSkip = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.skipStep()
    }
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.backStep()
    }
  }

  const handleFinish = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.completeCapture()
    }
  }

  // Completion screen
  if (isComplete) {
    return (
      <div className="fixed inset-0 pointer-events-none p-4 bg-white/0">
        <Card className="glass-dark w-96 pointer-events-auto rounded-2xl border-white/20">
          <CardHeader className="pb-3 cursor-move" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              All Steps Complete!
            </CardTitle>
          </CardHeader>
          <CardContent style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <p className="text-white/80 text-sm mb-4">
              All {activeSteps.length} screenshots have been captured.
            </p>
            <Button onClick={handleFinish} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <Check className="h-4 w-4 mr-2" />
              Finish
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 pointer-events-none p-4 bg-white/0">
      <Card className="glass-dark w-96 pointer-events-auto rounded-2xl border-white/20">
        <CardHeader className="pb-3 cursor-move" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white/90">
              Step {currentStepIndex + 1} of {activeSteps.length || hudData.totalSteps}
            </CardTitle>
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">
              {currentStep?.title || hudData.stepTitle}
            </h3>
            <p className="text-sm text-white/90 leading-relaxed">
              {currentStep?.description || hudData.stepDescription}
            </p>
          </div>
          <div className="pt-2 border-t pt-4 border-white/10">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-white/30 text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleCapture}
                disabled={captureStatus === 'capturing'}
                className={`flex-1 shadow-lg text-white transition-all duration-300 ${captureStatus === 'success'
                  ? 'bg-green-600 hover:bg-green-700'
                  : captureStatus === 'error'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {captureStatus === 'capturing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Capturing...
                  </>
                ) : captureStatus === 'success' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Capture
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                className="border-white/30 text-white hover:bg-white/10"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Skip
              </Button>
            </div>
            <p className="text-xs text-white/50 text-center mt-3">
              Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-xs">Ctrl+Shift+S</kbd> to capture
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

