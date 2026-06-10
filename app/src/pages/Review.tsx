import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ArrowRight, Loader2, Check, Image, X, Sparkles, RefreshCw, Pencil, ScanText, Crop, Lock } from 'lucide-react'
import { Step } from '@/lib/projectTypes'
import { generateScreenshotDescription, ocrImage, smartCrop, isLocalOnly, LocalOnlyError } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import WorkflowSteps from '@/components/WorkflowSteps'

export default function Review() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const projectPathFromQuery = searchParams.get('project')

  const [steps, setSteps] = useState<Step[]>(() => location.state?.steps || [])
  const [projectName, setProjectName] = useState(() => location.state?.projectName || 'Demo Project')
  const [loadedProjectPath, setLoadedProjectPath] = useState<string | null>(
    () => projectPathFromQuery || location.state?.projectPath || null
  )
  const [isLoading, setIsLoading] = useState(!!projectPathFromQuery && !location.state?.steps)
  const [previewImage, setPreviewImage] = useState<{ src: string; stepNumber: number; title: string } | null>(null)
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const [imageVersion, setImageVersion] = useState<Record<string, number>>({})
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [localOnly, setLocalOnly] = useState(false)

  useEffect(() => {
    isLocalOnly().then(setLocalOnly)
  }, [])

  useEffect(() => {
    async function loadProjectData() {
      if (!projectPathFromQuery || location.state?.steps) return
      try {
        setIsLoading(true)
        const result = await window.electronAPI.loadProject(projectPathFromQuery)
        if (result.success && result.project) {
          setProjectName(result.project.name || result.project.projectName || 'Untitled Project')
          setLoadedProjectPath(projectPathFromQuery)
          if (result.project.steps) {
            setSteps(result.project.steps.map((s: any) => ({
              id: s.id || crypto.randomUUID(),
              number: s.number,
              title: s.title,
              description: s.description || '',
              imagePath: s.imagePath,
              captured: !!s.imagePath,
              skipped: s.skipped || false,
              notes: s.notes || '',
              generated_description: s.generated_description || '',
              generated_caption: s.generated_caption || '',
              ocr_text: s.ocr_text || '',
              validation: s.validation || null,
              branches: s.branches || [],
            })))
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadProjectData()
  }, [projectPathFromQuery, location.state?.steps])

  const persist = useCallback(async (updated: Step[]) => {
    if (!loadedProjectPath) return
    await window.electronAPI.saveProjectManifest({
      projectPath: loadedProjectPath,
      manifest: {
        name: projectName,
        projectName,
        updatedAt: new Date().toISOString(),
        steps: updated.map((s) => ({
          id: s.id, number: s.number, title: s.title, description: s.description,
          imagePath: s.imagePath, captured: !!s.imagePath, skipped: s.skipped,
          notes: s.notes || '', generated_description: s.generated_description || '',
          generated_caption: s.generated_caption || '',
          ocr_text: s.ocr_text || '', validation: s.validation || null,
          branches: s.branches || [],
        })),
      },
    })
  }, [loadedProjectPath, projectName])

  const updateStep = useCallback((id: string, patch: Partial<Step>, save = true) => {
    setSteps((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      if (save) persist(updated)
      return updated
    })
  }, [persist])

  const absImage = (s: Step) =>
    s.imagePath && loadedProjectPath ? `${loadedProjectPath}/${s.imagePath}` : null

  const handleDescribe = async (s: Step) => {
    const img = absImage(s)
    if (!img) return
    setBusyStep(s.id)
    try {
      const { description } = await generateScreenshotDescription(s.title, img)
      updateStep(s.id, { generated_description: description })
    } catch (e) {
      reportAiError(e, 'Failed to generate description. Is the backend running?')
    } finally {
      setBusyStep(null)
    }
  }

  const reportAiError = (e: unknown, fallback: string) => {
    console.error(e)
    if (e instanceof LocalOnlyError) {
      toast({ variant: 'info', title: 'Local-only mode', description: e.message })
    } else {
      toast({ variant: 'error', title: 'AI request failed', description: fallback })
    }
  }

  const handleOcr = async (s: Step) => {
    const img = absImage(s)
    if (!img) return
    setBusyStep(s.id)
    try {
      const { text } = await ocrImage(img)
      updateStep(s.id, { ocr_text: text })
      toast({ variant: 'success', title: 'Text extracted', description: text ? `${text.length} characters captured.` : 'No text found in image.' })
    } catch (e) {
      reportAiError(e, 'Failed to extract text (OCR).')
    } finally {
      setBusyStep(null)
    }
  }

  const handleSmartCrop = async (s: Step) => {
    const img = absImage(s)
    if (!img) return
    setBusyStep(s.id)
    try {
      await smartCrop(s.title, img, { apply: true, outputPath: img })
      setImageVersion((v) => ({ ...v, [s.id]: (v[s.id] || 0) + 1 }))
      toast({ variant: 'success', title: 'Smart crop applied', description: 'Image cropped to the relevant region.' })
    } catch (e) {
      reportAiError(e, 'Failed to smart-crop.')
    } finally {
      setBusyStep(null)
    }
  }

  const handleRetake = async (s: Step) => {
    if (!loadedProjectPath) return
    setBusyStep(s.id)
    try {
      // Hide the app window so we capture the underlying screen.
      await window.electronAPI.hideWindow()
      await new Promise((r) => setTimeout(r, 700))
      const result = await window.electronAPI.retakeScreenshot({
        projectPath: loadedProjectPath,
        stepNumber: s.number,
        stepTitle: s.title,
        currentImage: s.imagePath || undefined,
      })
      await window.electronAPI.showWindow()
      if (result.success && result.filename) {
        updateStep(s.id, { imagePath: result.filename, captured: true })
        setImageVersion((v) => ({ ...v, [s.id]: (v[s.id] || 0) + 1 }))
      }
    } catch (e) {
      console.error(e)
      await window.electronAPI.showWindow()
    } finally {
      setBusyStep(null)
    }
  }

  const handleStartCapture = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) return
    let projectPathToUse = loadedProjectPath
    if (!projectPathToUse) {
      const result = await window.electronAPI.initProject(projectName)
      if (!result.success || !result.projectPath) {
        console.error('Failed to init project:', result.error)
        return
      }
      projectPathToUse = result.projectPath
      setLoadedProjectPath(projectPathToUse)
    }

    const activeSteps = steps
    const firstStep = activeSteps.find((s) => !s.imagePath)
    const currentStepIndex = firstStep ? activeSteps.indexOf(firstStep) : 0

    const manifest = {
      name: projectName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: steps.map((s) => ({
        id: s.id, number: s.number, title: s.title, description: s.description,
        imagePath: s.imagePath, captured: !!s.imagePath, skipped: s.skipped,
        notes: s.notes || '', generated_description: s.generated_description || '',
        generated_caption: s.generated_caption || '',
        ocr_text: s.ocr_text || '', validation: s.validation || null,
        branches: s.branches || [],
      })),
    }
    await window.electronAPI.saveProjectManifest({ projectPath: projectPathToUse, manifest })
    // Mark an active capture session for crash recovery.
    window.electronAPI.setActiveSession({ projectPath: projectPathToUse, inProgress: true })
    window.electronAPI.hideWindow()
    window.electronAPI.showHUD()

    if (firstStep) {
      window.electronAPI.updateHUDData({
        currentStep: currentStepIndex + 1,
        totalSteps: activeSteps.length,
        stepTitle: firstStep.title,
        stepDescription: firstStep.description,
        projectPath: projectPathToUse,
        stepNumber: firstStep.number,
        steps: activeSteps.map((s) => ({
          id: s.id, number: s.number, title: s.title, description: s.description,
          imagePath: s.imagePath, skipped: s.skipped,
        })),
      })
    }
    navigate('/capture')
  }

  const handleBack = () => {
    if (loadedProjectPath) {
      navigate(`/edit?project=${encodeURIComponent(loadedProjectPath)}`)
    } else {
      navigate('/create', { state: { projectName, steps } })
    }
  }

  const getImageSrc = (step: Step) => {
    const img = absImage(step)
    if (!img) return null
    const v = imageVersion[step.id] || 0
    return `file://${img}?v=${v}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-secondary/5 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  const capturedCount = steps.filter((s) => !!s.imagePath).length
  const hasUncapturedSteps = steps.some((s) => !s.imagePath && !s.skipped)
  const progress = steps.length ? Math.round((capturedCount / steps.length) * 100) : 0

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-secondary/5">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} className="gap-2 hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" />
            Edit Steps
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold gradient-text">Review Steps</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {capturedCount > 0 ? `${capturedCount} of ${steps.length} steps captured` : 'Review your steps before starting capture'}
            </p>
          </div>
          <Button
            onClick={() => {
              if (!hasUncapturedSteps) {
                navigate('/export', { state: { projectPath: loadedProjectPath, projectName, steps } })
              } else {
                handleStartCapture()
              }
            }}
            className="gap-2"
            disabled={steps.length === 0}
            size="lg"
            variant={!hasUncapturedSteps ? 'secondary' : 'default'}
          >
            {hasUncapturedSteps ? 'Start Capture' : 'Export'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <WorkflowSteps current="review" projectPath={loadedProjectPath} className="mb-2" />

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-lg text-muted-foreground">Project: <span className="text-foreground font-medium">{projectName}</span></p>
        </div>

        <ScrollArea className="h-[calc(100vh-320px)] pr-4 -mr-4">
          <div className="space-y-3 pb-10">
            {steps.map((step) => {
              const isCaptured = !!step.imagePath
              const imageSrc = getImageSrc(step)
              const isBusy = busyStep === step.id

              return (
                <Card key={step.id} className={`border-muted/50 bg-card/50 transition-colors ${isCaptured ? 'border-green-500/30 bg-green-500/5' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-4 items-start">
                      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full font-bold ${isCaptured ? 'bg-green-500/20 text-green-500' : 'bg-primary/20 text-primary'}`}>
                        {isCaptured ? <Check className="h-5 w-5" /> : step.number}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {step.title || <span className="text-muted-foreground italic">Untitled Step</span>}
                        </h3>
                        {step.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{step.description}</p>}
                        {step.generated_description && (
                          <p className="text-xs text-blue-300/80 mt-2 flex items-start gap-1">
                            <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-3">{step.generated_description}</span>
                          </p>
                        )}
                      </div>

                      {isCaptured && imageSrc && (
                        <button
                          onClick={() => setPreviewImage({ src: imageSrc, stepNumber: step.number, title: step.title })}
                          className="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden border border-green-500/30 hover:border-green-500/60 transition-all cursor-pointer relative group hover:scale-105"
                        >
                          <img src={imageSrc} alt={`Step ${step.number} capture`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Image className="h-5 w-5 text-white" />
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Action row for captured steps */}
                    {isCaptured && (
                      <div className="flex flex-wrap gap-2 pl-14">
                        <Button size="sm" variant="outline" onClick={() => handleDescribe(step)} disabled={isBusy || localOnly} title={localOnly ? 'Disabled in local-only mode' : ''} className="gap-1 h-8">
                          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : localOnly ? <Lock className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />} Describe
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleOcr(step)} disabled={isBusy || localOnly} title={localOnly ? 'Disabled in local-only mode' : ''} className="gap-1 h-8">
                          {localOnly ? <Lock className="h-3 w-3" /> : <ScanText className="h-3 w-3" />} OCR
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSmartCrop(step)} disabled={isBusy || localOnly} title={localOnly ? 'Disabled in local-only mode' : ''} className="gap-1 h-8">
                          {localOnly ? <Lock className="h-3 w-3" /> : <Crop className="h-3 w-3" />} Smart Crop
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRetake(step)} disabled={isBusy} className="gap-1 h-8">
                          <RefreshCw className="h-3 w-3" /> Retake
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate('/annotate', { state: { projectPath: loadedProjectPath, step, projectName } })} disabled={isBusy} className="gap-1 h-8">
                          <Pencil className="h-3 w-3" /> Annotate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNotes(editingNotes === step.id ? null : step.id)} className="gap-1 h-8">
                          Notes
                        </Button>
                      </div>
                    )}

                    {step.ocr_text && (
                      <div className="pl-14">
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <ScanText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-3 font-mono">{step.ocr_text}</span>
                        </p>
                      </div>
                    )}

                    {editingNotes === step.id && (
                      <div className="pl-14">
                        <Textarea
                          value={step.notes || ''}
                          onChange={(e) => updateStep(step.id, { notes: e.target.value }, false)}
                          onBlur={() => persist(steps)}
                          placeholder="Add a note for this step..."
                          className="text-sm"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {steps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No steps defined yet.</p>
                <Button variant="link" onClick={handleBack} className="mt-2">Go back to add steps</Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8" onClick={() => setPreviewImage(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setPreviewImage(null)}>
            <X className="h-6 w-6" />
          </Button>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={previewImage.src} alt={`Step ${previewImage.stepNumber} capture`} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-full text-sm text-white">
              Step {previewImage.stepNumber}: {previewImage.title || 'Untitled'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
