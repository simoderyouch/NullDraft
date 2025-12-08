import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function Capture() {
  const navigate = useNavigate()

  const handleFinish = () => {
    // Hide HUD window
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.hideHUD()
    }
    navigate('/export')
  }

  
  const handleCancel = () => {
    // Hide HUD window
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.hideHUD()
    }
    navigate('/review')
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </Button>
          <h1 className="text-3xl font-bold">Capture Mode</h1>
          <Button
            onClick={handleFinish}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Finish
          </Button>
        </div>

        {/* Status Card */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Capture in Progress
            </CardTitle>
            <CardDescription>
              Use the floating HUD overlay to capture screenshots for each step
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                HUD overlay is active
              </div>
              <p className="text-sm text-muted-foreground">
                Follow the instructions in the floating HUD window. Press{' '}
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+Shift+S</kbd>{' '}
                to capture screenshots.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>The floating HUD will guide you through each step</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Click "Capture" in the HUD or press Ctrl+Shift+S to take a screenshot</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>You can skip steps that don't require screenshots</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Click "Finish" when you're done capturing all screenshots</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

