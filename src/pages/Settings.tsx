import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Save, RotateCcw, Key, Keyboard, Palette } from 'lucide-react'

export default function Settings() {
  const navigate = useNavigate()
  const [apiKey, setApiKey] = useState('')
  const [captureHotkey, setCaptureHotkey] = useState('Ctrl+Shift+S')
  const [skipHotkey, setSkipHotkey] = useState('Ctrl+Shift+N')
  const [darkMode, setDarkMode] = useState(false)

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving settings:', {
      apiKey: apiKey ? '***' : '',
      captureHotkey,
      skipHotkey,
      darkMode,
    })
  }

  const handleReset = () => {
    setApiKey('')
    setCaptureHotkey('Ctrl+Shift+S')
    setSkipHotkey('Ctrl+Shift+N')
    setDarkMode(false)
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
          <h1 className="text-3xl font-bold">Settings</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>

        {/* API Key Section */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Configure your API key for AI processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored locally and never shared
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hotkey Configuration */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </CardTitle>
            <CardDescription>
              Customize keyboard shortcuts for capture actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="captureHotkey">Capture Screenshot</Label>
              <Input
                id="captureHotkey"
                value={captureHotkey}
                onChange={(e) => setCaptureHotkey(e.target.value)}
                placeholder="Ctrl+Shift+S"
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Click to customize (coming soon)
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="skipHotkey">Skip Step</Label>
              <Input
                id="skipHotkey"
                value={skipHotkey}
                onChange={(e) => setSkipHotkey(e.target.value)}
                placeholder="Ctrl+Shift+N"
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Click to customize (coming soon)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the application appearance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="darkMode">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Switch to dark theme
                </p>
              </div>
              <Switch
                id="darkMode"
                checked={darkMode}
                onCheckedChange={setDarkMode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

