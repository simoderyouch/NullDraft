import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import StepItem from '@/components/StepItem'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'

interface Step {
  id: string
  number: number
  title: string
  caption: string
  checked: boolean
  skipped: boolean
}

const mockSteps: Step[] = [
  {
    id: '1',
    number: 1,
    title: 'Open the application',
    caption: 'Figure 1: Launch the main application window',
    checked: false,
    skipped: false,
  },
  {
    id: '2',
    number: 2,
    title: 'Navigate to Settings',
    caption: 'Figure 2: Click on the Settings menu item',
    checked: true,
    skipped: false,
  },
  {
    id: '3',
    number: 3,
    title: 'Configure preferences',
    caption: 'Figure 3: Adjust the configuration options',
    checked: false,
    skipped: false,
  },
  {
    id: '4',
    number: 4,
    title: 'Save changes',
    caption: 'Figure 4: Click the Save button to apply changes',
    checked: false,
    skipped: false,
  },
  {
    id: '5',
    number: 5,
    title: 'Verify installation',
    caption: 'Figure 5: Confirm the installation is complete',
    checked: false,
    skipped: false,
  },
  {
    id: '6',
    number: 6,
    title: 'Test functionality',
    caption: 'Figure 6: Run a test to verify everything works',
    checked: false,
    skipped: false,
  },
]

export default function Review() {
  const navigate = useNavigate()
  const [steps, setSteps] = useState<Step[]>(mockSteps)

  const totalSteps = steps.length
  const checkedSteps = steps.filter((s) => s.checked).length
  const screenshotCount = steps.filter((s) => !s.skipped).length

  const handleToggleStep = (stepId: string, checked: boolean) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, checked } : step
      )
    )
  }

  const handleEdit = (stepId: string) => {
    // TODO: Implement edit logic
    console.log('Edit step:', stepId)
  }

  const handleSkip = (stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, skipped: !step.skipped } : step
      )
    )
  }

  const handleAddCustomStep = () => {
    // TODO: Implement add custom step logic
    console.log('Add custom step')
  }

  const handleStartCapture = () => {
    // Show HUD window and navigate to capture
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.showHUD()
      // Update HUD with first step data
      const firstStep = steps.find((s) => !s.skipped && !s.checked)
      if (firstStep) {
        window.electronAPI.updateHUDData({
          currentStep: firstStep.number,
          totalSteps: totalSteps,
          stepTitle: firstStep.title,
          stepDescription: firstStep.caption,
        })
      }
    }
    navigate('/capture')
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Review Steps</h1>
          <Button
            onClick={handleStartCapture}
            className="gap-2"
          >
            Start Capture
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Bar */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                ✓ {checkedSteps} steps completed
              </Badge>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                📸 {screenshotCount} screenshots required
              </Badge>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-base px-3 py-1">
                {totalSteps} total steps
              </Badge>
            </div>
          </div>
        </div>

        {/* Steps List */}
        <ScrollArea className="h-[calc(100vh-300px)] pr-4">
          <div className="space-y-3">
            {steps.map((step) => (
              <StepItem
                key={step.id}
                stepNumber={step.number}
                title={step.title}
                caption={step.caption}
                checked={step.checked}
                onToggle={(checked) => handleToggleStep(step.id, checked)}
                onEdit={() => handleEdit(step.id)}
                onSkip={() => handleSkip(step.id)}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Add Custom Step Button */}
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={handleAddCustomStep}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Custom Step
          </Button>
        </div>
      </div>
    </div>
  )
}

