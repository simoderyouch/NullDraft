import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Loader2, Check, Image, X } from 'lucide-react'
import { Step } from '@/lib/projectTypes'

export default function Review() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const projectPathFromQuery = searchParams.get('project')

  const [steps, setSteps] = useState<Step[]>(() => {
    if (location.state?.steps) {
      return location.state.steps
    }
    return []
  })
  const [projectName, setProjectName] = useState(() => location.state?.projectName || 'Demo Project')
  // Initialize from query param OR from location state (when coming back from capture)
  const [loadedProjectPath, setLoadedProjectPath] = useState<string | null>(
    () => projectPathFromQuery || location.state?.projectPath || null
  )
  const [isLoading, setIsLoading] = useState(!!projectPathFromQuery && !location.state?.steps)
  const [previewImage, setPreviewImage] = useState<{ src: string; stepNumber: number; title: string } | null>(null)

  // Load project data from path if provided in query params
  useEffect(() => {
    async function loadProjectData() {
      if (!projectPathFromQuery || location.state?.steps) return

      try {
        setIsLoading(true)
        const result = await window.electronAPI.loadProject(projectPathFromQuery)

        if (result.success && result.project) {
          setProjectName(result.project.name || result.project.projectName || 'Untitled Project')
          setLoadedProjectPath(projectPathFromQuery)

          // Map manifest steps to Step interface
          if (result.project.steps) {
            const loadedSteps: Step[] = result.project.steps.map((s: any) => ({
              id: s.id || crypto.randomUUID(),
              number: s.number,
              title: s.title,
              description: s.description || '',
              imagePath: s.imagePath,
              skipped: s.skipped || false,
            }))
            setSteps(loadedSteps)
          }
        } else {
          console.error('Failed to load project:', result.error)
        }
      } catch (error) {
        console.error('Failed to load project:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProjectData()
  }, [projectPathFromQuery, location.state?.steps])

  const handleStartCapture = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) return

    // Use loaded project path if available, otherwise init new project
    let projectPathToUse = loadedProjectPath

    if (!projectPathToUse) {
      // Initialize project folder
      const result = await window.electronAPI.initProject(projectName)
      if (!result.success || !result.projectPath) {
        console.error('Failed to init project:', result.error)
        return
      }
      projectPathToUse = result.projectPath
      // Update the loaded project path for future use
      setLoadedProjectPath(projectPathToUse)
    }

    const activeSteps = steps
    const firstStep = activeSteps.find((s) => !s.imagePath)
    const currentStepIndex = firstStep ? activeSteps.indexOf(firstStep) : 0

    // Save initial manifest
    const manifest = {
      name: projectName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: steps.map(s => ({
        id: s.id,
        number: s.number,
        title: s.title,
        description: s.description,
        imagePath: s.imagePath,
        captured: !!s.imagePath,
        skipped: s.skipped,
      })),
    }
    await window.electronAPI.saveProjectManifest({ projectPath: projectPathToUse, manifest })

    // Hide main window so only HUD is visible during capture
    window.electronAPI.hideWindow()

    // Show HUD with project context
    window.electronAPI.showHUD()

    if (firstStep) {
      window.electronAPI.updateHUDData({
        currentStep: currentStepIndex + 1,
        totalSteps: activeSteps.length,
        stepTitle: firstStep.title,
        stepDescription: firstStep.description,
        projectPath: projectPathToUse,
        stepNumber: firstStep.number,
        steps: activeSteps.map(s => ({
          id: s.id,
          number: s.number,
          title: s.title,
          description: s.description,
          imagePath: s.imagePath,
          skipped: s.skipped,
        })),
      })
    }

    navigate('/capture')
  }

  const handleBack = () => {
    // Navigate to EditProject if we have a project path, otherwise CreateProject
    if (loadedProjectPath) {
      navigate(`/edit?project=${encodeURIComponent(loadedProjectPath)}`)
    } else {
      navigate('/create', {
        state: {
          projectName,
          steps
        }
      })
    }
  }

  // Get image source for a step
  const getImageSrc = (step: Step) => {
    if (!step.imagePath) return null
    if (loadedProjectPath) {
      return `file://${loadedProjectPath}/${step.imagePath}`
    }
    return null
  }

  // Show loading state while loading project from filesystem
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

  // Count captured steps
  const capturedCount = steps.filter(s => !!s.imagePath).length
  const hasUncapturedSteps = steps.some(s => !s.imagePath)

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-secondary/5">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="gap-2 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Edit Steps
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Review Steps</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {capturedCount > 0
                ? `${capturedCount} of ${steps.length} steps captured`
                : 'Review your steps before starting capture'
              }
            </p>
          </div>
          <Button
            onClick={handleStartCapture}
            className="gap-2   hover:shadow-primary/40 transition-shadow"
            disabled={steps.length === 0 || !hasUncapturedSteps}
            size="lg"
          >
            {hasUncapturedSteps ? 'Start Capture' : 'All Done'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Project Name */}
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Project: <span className="text-foreground font-medium">{projectName}</span></p>
        </div>

        {/* Steps List - Read Only */}
        <ScrollArea className="h-[calc(100vh-300px)] pr-4 -mr-4">
          <div className="space-y-3 pb-10">
            {steps.map((step) => {
              const isCaptured = !!step.imagePath
              const imageSrc = getImageSrc(step)

              return (
                <Card
                  key={step.id}
                  className={`border-muted/50 bg-card/50 transition-colors ${isCaptured ? 'border-green-500/30 bg-green-500/5' : ''
                    }`}
                >
                  <CardContent className="p-4 flex gap-4 items-start">
                    {/* Step Number / Captured Check */}
                    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full font-bold ${isCaptured
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-primary/20 text-primary'
                      }`}>
                      {isCaptured ? <Check className="h-5 w-5" /> : step.number}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {step.title || <span className="text-muted-foreground italic">Untitled Step</span>}
                      </h3>
                      {step.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {step.description}
                        </p>
                      )}
                      {isCaptured && (
                        <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Captured
                        </p>
                      )}
                    </div>

                    {/* Screenshot Thumbnail */}
                    {isCaptured && imageSrc && (
                      <button
                        onClick={() => setPreviewImage({
                          src: imageSrc,
                          stepNumber: step.number,
                          title: step.title
                        })}
                        className="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden border border-green-500/30 hover:border-green-500/60 transition-all cursor-pointer relative group hover:scale-105"
                      >
                        <img
                          src={imageSrc}
                          alt={`Step ${step.number} capture`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Image className="h-5 w-5 text-white" />
                        </div>
                      </button>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {steps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No steps defined yet.</p>
                <Button variant="link" onClick={handleBack} className="mt-2">
                  Go back to add steps
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Full Screen Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
          onClick={() => setPreviewImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={previewImage.src}
              alt={`Step ${previewImage.stepNumber} capture`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-full text-sm text-white">
              Step {previewImage.stepNumber}: {previewImage.title || 'Untitled'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

