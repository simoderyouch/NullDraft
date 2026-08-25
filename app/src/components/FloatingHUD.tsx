import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Camera, ArrowRight, ArrowLeft, Check, Loader2, CheckCircle2, Minimize2, Maximize2, StickyNote, Home, ChevronDown, ChevronUp } from 'lucide-react'

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

const HUD_DESCRIPTION_LIMIT = 160

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
  const [captureMode, setCaptureMode] = useState<'fullscreen' | 'window' | 'display' | 'region'>('fullscreen')
  const [displays, setDisplays] = useState<Array<{ id: number; label: string; isPrimary: boolean }>>([])
  const [displayId, setDisplayId] = useState<number | undefined>(undefined)
  const [reuseLastRegion, setReuseLastRegion] = useState(false)
  const [miniMode, setMiniMode] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  // Get active (non-skipped) steps
  const activeSteps = useMemo(() => hudData.steps?.filter(s => !s.skipped) || [], [hudData.steps])
  const currentStep = activeSteps[currentStepIndex]
  const stepDescription = currentStep?.description || hudData.stepDescription
  const shouldCollapseDescription = stepDescription.length > HUD_DESCRIPTION_LIMIT
  const displayedDescription = shouldCollapseDescription && !isDescriptionExpanded
    ? `${stepDescription.slice(0, HUD_DESCRIPTION_LIMIT).trimEnd()}…`
    : stepDescription

  useEffect(() => {
    setIsDescriptionExpanded(false)
  }, [currentStep?.id, hudData.stepNumber, hudData.stepDescription])

  useEffect(() => {
    async function loadDisplays() {
      try {
        if (window.electronAPI?.getDisplays) {
          const d = await window.electronAPI.getDisplays()
          setDisplays(d.map((x) => ({ id: x.id, label: x.label, isPrimary: x.isPrimary })))
        }
      } catch { /* ignore */ }
    }
    loadDisplays()
  }, [])

  const persistNote = useCallback(async (stepNumber: number, value: string) => {
    if (!hudData.projectPath) return
    try {
      const result = await window.electronAPI.loadProject(hudData.projectPath)
      if (result.success && result.project) {
        const manifest = result.project
        manifest.steps = (manifest.steps || []).map((s: any) =>
          s.number === stepNumber ? { ...s, notes: value } : s
        )
        manifest.updatedAt = new Date().toISOString()
        delete manifest.path
        await window.electronAPI.saveProjectManifest({ projectPath: hudData.projectPath, manifest })
      }
    } catch (e) {
      console.error('Failed to persist note', e)
    }
  }, [hudData.projectPath])

  const handleCapture = useCallback(async () => {
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

        const result = await window.electronAPI.captureScreenshot(stepInfo, {
          mode: captureMode,
          displayId: captureMode === 'display' ? displayId : undefined,
          reuseLastRegion: captureMode === 'region' ? reuseLastRegion : undefined,
        })
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
  }, [captureStatus, currentStep, hudData.projectPath, captureMode, displayId, reuseLastRegion])

  const handleSkip = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.skipStep()
    }
  }, [])

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.backStep()
    }
  }, [])

  const handleFinish = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.completeCapture()
    }
  }, [])

  const handleExitHome = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.exitCaptureToHome?.()
    }
  }, [])

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

      window.electronAPI.onHotkeyCapture(() => {
        handleCapture()
      })

      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeHUDDataListener()
          window.electronAPI.removeCaptureSuccessListener()
          window.electronAPI.removeStepSkippedListener()
          window.electronAPI.removeStepBackListener()
          window.electronAPI.removeHotkeyCaptureListener()
        }
      }
    }
  }, [advanceStep, currentStepIndex, activeSteps, handleCapture])

  useEffect(() => {
    // Set body background to transparent for the HUD window
    const originalBackground = document.body.style.background
    document.body.style.background = 'transparent'

    return () => {
      document.body.style.background = originalBackground
    }
  }, [])

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

  const total = activeSteps.length || hudData.totalSteps
  const progress = total ? Math.round(((currentStepIndex) / total) * 100) : 0

  // Mini-toolbar mode: compact horizontal bar
  if (miniMode) {
    return (
      <div className="fixed inset-0 pointer-events-none p-4 bg-white/0">
        <Card className="glass-dark inline-flex pointer-events-auto rounded-full border-white/20" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <CardContent className="flex items-center gap-2 p-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <span className="text-xs text-white/80 px-2 cursor-move" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
              {currentStepIndex + 1}/{total}
            </span>
            <Button size="icon" variant="outline" onClick={handleBack} className="h-8 w-8 border-white/30 text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={handleCapture} disabled={captureStatus === 'capturing'} className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white">
              {captureStatus === 'capturing' ? <Loader2 className="h-4 w-4 animate-spin" /> : captureStatus === 'success' ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={handleSkip} className="h-8 w-8 border-white/30 text-white hover:bg-white/10">
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setMiniMode(false)} className="h-8 w-8 text-white/70 hover:bg-white/10">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleExitHome} className="h-8 w-8 text-white/70 hover:bg-white/10" title="Exit to home">
              <Home className="h-4 w-4" />
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
              Step {currentStepIndex + 1} of {total}
            </CardTitle>
            <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <Button size="icon" variant="ghost" onClick={handleExitHome} className="h-6 w-6 text-white/70 hover:bg-white/10" title="Exit to home">
                <Home className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setMiniMode(true)} className="h-6 w-6 text-white/70 hover:bg-white/10" title="Mini mode">
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mt-2">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-white">
              {currentStep?.title || hudData.stepTitle}
            </h3>
            <p className="text-sm text-white/90 leading-relaxed">
              {displayedDescription}
            </p>
            {shouldCollapseDescription && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
                className="h-6 px-1 text-xs text-blue-200 hover:bg-white/10 hover:text-white"
              >
                {isDescriptionExpanded ? (
                  <><ChevronUp className="mr-1 h-3.5 w-3.5" />Show less</>
                ) : (
                  <><ChevronDown className="mr-1 h-3.5 w-3.5" />See more</>
                )}
              </Button>
            )}
          </div>

          {/* Capture mode selector */}
          <div className="flex items-center gap-2">
            <HUDSelect
              value={captureMode}
              onValueChange={(value) => setCaptureMode(value as typeof captureMode)}
              options={[
                { value: 'fullscreen', label: 'Full screen' },
                { value: 'window', label: 'Active window' },
                { value: 'display', label: 'Specific display' },
                { value: 'region', label: 'Region (drag to select)' },
              ]}
            />
            {captureMode === 'display' && (
              <HUDSelect
                value={displayId == null ? '' : String(displayId)}
                onValueChange={(value) => setDisplayId(value ? Number(value) : undefined)}
                options={[
                  { value: '', label: 'Choose display…' },
                  ...displays.map((display) => ({
                    value: String(display.id),
                    label: `${display.label}${display.isPrimary ? ' (primary)' : ''}`,
                  })),
                ]}
              />
            )}
            <Button size="icon" variant="ghost" onClick={() => setShowNotes(!showNotes)} className="h-8 w-8 text-white/70 hover:bg-white/10" title="Notes">
              <StickyNote className="h-4 w-4" />
            </Button>
          </div>

          {/* Region memory toggle */}
          {captureMode === 'region' && (
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={reuseLastRegion} onChange={(e) => setReuseLastRegion(e.target.checked)} />
              Reuse last selected region
            </label>
          )}

          {/* Per-step notes */}
          {showNotes && currentStep && (
            <textarea
              value={notes[currentStep.number] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [currentStep.number]: e.target.value }))}
              onBlur={(e) => persistNote(currentStep.number, e.target.value)}
              placeholder="Quick note for this step..."
              className="w-full h-16 rounded-md bg-white/10 border border-white/20 text-white text-xs p-2 resize-none placeholder:text-white/40"
            />
          )}

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
              Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-xs">Ctrl + Shift + S</kbd> to capture
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

type HUDSelectOption = {
  value: string
  label: string
}

function HUDSelect({
  value,
  onValueChange,
  options,
}: {
  value: string
  onValueChange: (value: string) => void
  options: HUDSelectOption[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isOpen])

  const chooseOption = (nextValue: string) => {
    onValueChange(nextValue)
    setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen((open) => !open)
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const currentIndex = Math.max(0, options.findIndex((option) => option.value === value))
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + direction + options.length) % options.length
      onValueChange(options[nextIndex].value)
      setIsOpen(true)
    }
  }

  return (
    <div ref={selectRef} className="relative flex-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleKeyDown}
        className="flex h-8 w-full items-center justify-between rounded-md border border-white/20 bg-white/10 px-2 text-left text-xs text-white transition-colors hover:border-white/35 hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`ml-2 h-3.5 w-3.5 shrink-0 text-white/65 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 z-[90] mt-1 w-full overflow-hidden rounded-lg border border-white/20 bg-[hsla(222,44%,12%,0.98)] p-1 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value || '__empty__'}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => chooseOption(option.value)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors ${isSelected
                  ? 'bg-blue-500/25 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-blue-300" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
