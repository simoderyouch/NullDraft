import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus, Trash2, ArrowRight, ArrowLeft, GripVertical, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { v4 as uuidv4 } from 'uuid'
import { Step } from '@/lib/projectTypes'
import { Reorder, useDragControls } from 'framer-motion'

export default function EditProject() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const projectPathFromQuery = searchParams.get('project')

    const [projectName, setProjectName] = useState('')
    const [projectPath, setProjectPath] = useState<string | null>(null)
    const [steps, setSteps] = useState<Step[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Load project data on mount
    useEffect(() => {
        async function loadProject() {
            if (!projectPathFromQuery) {
                setIsLoading(false)
                return
            }

            try {
                const result = await window.electronAPI.loadProject(projectPathFromQuery)
                if (result.success && result.project) {
                    setProjectName(result.project.name || result.project.projectName || 'Untitled')
                    setProjectPath(projectPathFromQuery)

                    if (result.project.steps) {
                        const loadedSteps: Step[] = result.project.steps.map((s: any) => ({
                            id: s.id || uuidv4(),
                            number: s.number,
                            title: s.title,
                            description: s.description || '',
                            imagePath: s.imagePath,
                            captured: !!s.imagePath,
                            skipped: s.skipped || false,
                        }))
                        setSteps(loadedSteps)
                    }
                }
            } catch (error) {
                console.error('Failed to load project:', error)
            } finally {
                setIsLoading(false)
            }
        }

        loadProject()
    }, [projectPathFromQuery])

    const handleAddStep = () => {
        setSteps(prev => [
            ...prev,
            {
                id: uuidv4(),
                number: prev.length + 1,
                title: '',
                description: '',
                imagePath: null,
                captured: false,
                skipped: false
            }
        ])
    }

    const handleRemoveStep = (id: string) => {
        if (steps.length <= 1) return
        setSteps(prev =>
            prev
                .filter(s => s.id !== id)
                .map((s, idx) => ({ ...s, number: idx + 1 }))
        )
    }

    const handleReorder = (newOrder: Step[]) => {
        const updatedSteps = newOrder.map((step, index) => ({
            ...step,
            number: index + 1
        }))
        setSteps(updatedSteps)
    }

    const handleStepChange = (id: string, field: keyof Step, value: string) => {
        setSteps(prev =>
            prev.map(step =>
                step.id === id ? { ...step, [field]: value } : step
            )
        )
    }

    const handleContinue = async () => {
        if (!projectName.trim()) return

        // Save the updated manifest first
        if (projectPath) {
            const manifest = {
                name: projectName,
                projectName: projectName,
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
            await window.electronAPI.saveProjectManifest({ projectPath, manifest })
        }

        navigate('/review', {
            state: {
                projectName,
                steps,
                projectPath
            }
        })
    }

    if (isLoading) {
        return (
            <div className="min-h-screen p-8 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Loading project...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center z-99 justify-between">
                    <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <h1 className="text-3xl font-bold">Edit Project</h1>

                    <Button
                        size="lg"
                        onClick={handleContinue}
                        disabled={!projectName.trim()}
                        className="gap-2"
                    >
                        Review
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>

                <Card className="border-white/10">
                    <CardHeader>
                        <CardTitle>Project Details</CardTitle>
                        <CardDescription>Edit your project name and steps.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="projectName">Project Name</Label>
                            <Input
                                id="projectName"
                                placeholder="e.g. How to install Docker"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="bg-background/50"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Steps</h2>
                        <Button onClick={handleAddStep} variant="secondary" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Step
                        </Button>
                    </div>

                    <ScrollArea className="h-[calc(100vh-450px)] pr-4">
                        <Reorder.Group axis="y" values={steps} onReorder={handleReorder} className="space-y-4 pb-8">
                            {steps.map((step) => (
                                <StepCard
                                    key={step.id}
                                    step={step}
                                    stepsLength={steps.length}
                                    onStepChange={handleStepChange}
                                    onRemoveStep={handleRemoveStep}
                                />
                            ))}
                        </Reorder.Group>
                    </ScrollArea>
                </div>
            </div>
        </div>
    )
}

function StepCard({
    step,
    stepsLength,
    onStepChange,
    onRemoveStep
}: {
    step: Step
    stepsLength: number
    onStepChange: (id: string, field: keyof Step, value: string) => void
    onRemoveStep: (id: string) => void
}) {
    const dragControls = useDragControls()

    return (
        <Reorder.Item
            value={step}
            id={step.id}
            dragListener={false}
            dragControls={dragControls}
            className="relative"
            whileDrag={{
                scale: 1.02,
                zIndex: 50,
                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
            }}
        >
            <Card className="border-muted/50">
                <CardContent className="p-4 flex gap-4 items-start pt-6">
                    {/* Drag Handle */}
                    <div
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none hover:bg-white/5 rounded transition-colors"
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <GripVertical className="h-5 w-5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                    </div>

                    {/* Step Number */}
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
                        {step.number}
                    </div>

                    {/* Form Fields */}
                    <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                            <Label>Step Title</Label>
                            <Input
                                value={step.title}
                                onChange={(e) => onStepChange(step.id, 'title', e.target.value)}
                                placeholder="e.g. Open Terminal"
                                className="bg-background/50"
                            />
                        </div>
                        <div className="space-y-2 !mb-5">
                            <Label>Description / Caption</Label>
                            <Input
                                value={step.description}
                                onChange={(e) => onStepChange(step.id, 'description', e.target.value)}
                                placeholder="e.g. Launch the terminal application from the dock."
                                className="bg-background/50"
                            />
                        </div>
                    </div>

                    {/* Delete Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveStep(step.id)}
                        disabled={stepsLength <= 1}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        </Reorder.Item>
    )
}
