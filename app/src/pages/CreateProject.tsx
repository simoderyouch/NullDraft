import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus, Trash2, ArrowRight, ArrowLeft, GripVertical, UploadCloud } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { v4 as uuidv4 } from 'uuid'
import { ProjectLanguage, Step } from '@/lib/projectTypes'
import { Reorder, useDragControls } from 'framer-motion'
import { uploadAssessmentAndGenerateSteps } from '@/lib/api'
import { getManualLanguageOverride, resolveConfiguredLanguage } from '@/lib/language'
import { useToast } from '@/components/ui/toast'

export default function CreateProject() {
    const navigate = useNavigate()
    const location = useLocation()
    const { toast } = useToast()

    // Initialize from location.state if returning from Review, otherwise default
    const [projectName, setProjectName] = useState(() =>
        location.state?.projectName || ''
    )
    const [language, setLanguage] = useState<ProjectLanguage>(() =>
        location.state?.language || { code: 'en', name: 'English' }
    )

    const [steps, setSteps] = useState<Step[]>(() => {
        if (location.state?.steps && location.state.steps.length > 0) {
            return location.state.steps
        }
        return [{
            id: uuidv4(),
            number: 1,
            title: '',
            caption: '',
            description: '',
            imagePath: null,
            captured: false,
            skipped: false
        }]
    })

    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const processFile = async (file: File) => {
        setIsUploading(true)
        try {
            if (!projectName.trim()) {
                setProjectName(file.name.replace(/\.[^.]+$/, ''))
            }
            const languageOverride = await getManualLanguageOverride()
            const data = await uploadAssessmentAndGenerateSteps(file, languageOverride)
            const projectLanguage = await resolveConfiguredLanguage(data.language)
            setLanguage(projectLanguage)
            if (data.steps && Array.isArray(data.steps)) {
                setSteps(data.steps.map((s: any, idx: number) => ({
                    id: uuidv4(),
                    number: idx + 1,
                    title: s.title || '',
                    caption: s.caption || s.title || '',
                    description: s.description || '',
                    imagePath: null,
                    captured: false,
                    skipped: false
                })))
                toast({ variant: 'success', title: 'Steps generated', description: `${data.steps.length} step(s) created from your file.` })
            }
        } catch (error) {
            console.error('Failed to generate steps:', error)
            toast({ variant: 'error', title: 'Could not generate steps', description: 'Is the backend running and the API key set?' })
        } finally {
            setIsUploading(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await processFile(file)
    }

    // Handle a file dropped on the dashboard, or a template chosen there.
    useEffect(() => {
        const hasDroppedFile = location.state?.droppedFile instanceof File
        if (!location.state?.language && !hasDroppedFile) {
            resolveConfiguredLanguage().then(setLanguage)
        }
        if (hasDroppedFile) {
            processFile(location.state.droppedFile)
        } else if (location.state?.templateSteps && Array.isArray(location.state.templateSteps)) {
            setSteps(location.state.templateSteps.map((s: any, idx: number) => ({
                id: uuidv4(),
                number: idx + 1,
                title: s.title || '',
                caption: s.caption || s.title || '',
                description: s.description || '',
                imagePath: null,
                captured: false,
                skipped: false,
            })))
            if (location.state.templateName && !projectName.trim()) {
                setProjectName(location.state.templateName)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleAddStep = () => {
        setSteps(prev => [
            ...prev,
            {
                id: uuidv4(),
                number: prev.length + 1,
                title: '',
                caption: '',
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

    const handleContinue = () => {
        if (!projectName.trim()) return

        navigate('/review', {
            state: {
                projectName,
                steps,
                language
            }
        })
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
                    <h1 className="text-3xl font-bold gradient-text">New Project</h1>

                    <div className="flex justify-end pt-4 border-t border-white/10">
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

                </div>

                <Card className=" border-white/10">
                    <CardHeader>
                        <CardTitle>Project Details</CardTitle>
                        <CardDescription>Name your project and define the steps.</CardDescription>
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
                        
                        <div className="space-y-2 border-t pt-4">
                            <Label>Or upload an assignment/TP file to auto-generate steps (txt, md, pdf, docx, tex)</Label>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload}
                                    accept=".txt,.md,.pdf,.docx,.tex"
                                />
                                <Button 
                                    variant="outline" 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                >
                                    <UploadCloud className="h-4 w-4 mr-2" />
                                    {isUploading ? 'Generating...' : 'Upload File'}
                                </Button>
                            </div>
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

                    <ScrollArea className="h-[calc(100vh-400px)] pr-4">
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
                        <div className="space-y-2">
                            <Label>Caption</Label>
                            <Input
                                value={step.caption || ''}
                                onChange={(e) => onStepChange(step.id, 'caption', e.target.value)}
                                placeholder="e.g. Terminal output after successful installation"
                                className="bg-background/50"
                            />
                        </div>
                        <div className="space-y-2 !mb-5">
                            <Label>Description</Label>
                            <Textarea
                                value={step.description}
                                onChange={(e) => onStepChange(step.id, 'description', e.target.value)}
                                placeholder="e.g. Explain what should be visible: command, output, file, validation result, or UI state."
                                className="min-h-28 resize-y bg-background/50 leading-relaxed"
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
