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
  const [captureHotkey, setCaptureHotkey] = useState('CommandOrControl+Shift+S')
  const [skipHotkey, setSkipHotkey] = useState('CommandOrControl+Shift+N')
  const [backHotkey, setBackHotkey] = useState('CommandOrControl+Shift+B')
  const [darkMode, setDarkMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load config on mount
  useState(() => {
    async function load() {
      try {
        const config = await window.electronAPI.getConfig()
        setApiKey(config.apiKey)
        setCaptureHotkey(config.captureHotkey)
        setSkipHotkey(config.skipHotkey)
        setBackHotkey(config.backHotkey) // Load back hotkey
        setDarkMode(config.darkMode)
      } catch (e) {
        console.error("Failed to load config", e)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  })

  const handleSave = async () => {
    try {
      const config = {
        apiKey,
        captureHotkey,
        skipHotkey,
        backHotkey,
        darkMode
      }
      await window.electronAPI.saveConfig(config)
      // Ideally show a toast here
      console.log('Settings saved')
      navigate('/')
    } catch (e) {
      console.error("Failed to save settings", e)
    }
  }

  const handleReset = () => {
    setApiKey('')
    setCaptureHotkey('CommandOrControl+Shift+S')
    setSkipHotkey('CommandOrControl+Shift+N')
    setBackHotkey('CommandOrControl+Shift+B')
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

        {isLoading ? (
          <div className="text-center py-20">Loading settings...</div>
        ) : (
          <>
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
                  Customize keyboard shortcuts for capture actions. Click an input field and press keys to record.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <HotkeyInput
                  label="Capture Screenshot"
                  value={captureHotkey}
                  onChange={setCaptureHotkey}
                  id="captureHotkey"
                />
                <Separator />
                <HotkeyInput
                  label="Skip Step"
                  value={skipHotkey}
                  onChange={setSkipHotkey}
                  id="skipHotkey"
                />
                <Separator />
                <HotkeyInput
                  label="Back Step"
                  value={backHotkey}
                  onChange={setBackHotkey}
                  id="backHotkey"
                />
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
          </>
        )}
      </div>
    </div>
  )
}

function HotkeyInput({ label, value, onChange, id }: { label: string, value: string, onChange: (val: string) => void, id: string }) {
  const [isRecording, setIsRecording] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return
    e.preventDefault()
    e.stopPropagation()

    // Ignore standalone modifier presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

    const modifiers = []
    if (e.ctrlKey) modifiers.push('CommandOrControl')
    if (e.metaKey) modifiers.push('CommandOrControl') // Treat meta as ctrl/cmd
    if (e.shiftKey) modifiers.push('Shift')
    if (e.altKey) modifiers.push('Alt')

    // If no modifiers, maybe don't allow? Or allow function keys.
    // For now, let's just append the key.
    let key = e.key.toUpperCase()
    if (key === ' ') key = 'Space'

    // Electron accelerator format
    const finalKey = [...new Set(modifiers), key].join('+')

    onChange(finalKey)
    setIsRecording(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={value.replace('CommandOrControl', 'Ctrl')} // Display friendly name
          onFocus={() => setIsRecording(true)}
          onBlur={() => setIsRecording(false)}
          onKeyDown={handleKeyDown}
          className={`cursor-pointer ${isRecording ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-muted'}`}
          readOnly // Prevent typing manually
        />
        {isRecording && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium animate-pulse">
            Listening...
          </div>
        )}
      </div>
      {!isRecording && (
        <p className="text-xs text-muted-foreground">
          Click to record shortcut
        </p>
      )}
    </div>
  )
}

