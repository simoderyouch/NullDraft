import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Save, RotateCcw, Key, Keyboard, Palette, FolderOpen, FileOutput, Camera, ShieldCheck, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export default function Settings() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState('mistral')
  const [captureHotkey, setCaptureHotkey] = useState('CommandOrControl+Shift+S')
  const [skipHotkey, setSkipHotkey] = useState('CommandOrControl+Shift+N')
  const [backHotkey, setBackHotkey] = useState('CommandOrControl+Shift+B')
  const [darkMode, setDarkMode] = useState(false)
  const [defaultProjectLocation, setDefaultProjectLocation] = useState('')
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exportTemplate, setExportTemplate] = useState('default')
  const [screenshotFormat, setScreenshotFormat] = useState('png')
  const [screenshotQuality, setScreenshotQuality] = useState(90)
  const [localOnly, setLocalOnly] = useState(false)
  const [encryptProjects, setEncryptProjects] = useState(false)
  const [encryptionPassphrase, setEncryptionPassphrase] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [backendStatus, setBackendStatus] = useState<string>('checking...')
  const [baseConfig, setBaseConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const config = await window.electronAPI.getConfig()
        setBaseConfig(config)
        setApiKey(config.apiKey || '')
        setProvider(config.provider || 'mistral')
        setCaptureHotkey(config.captureHotkey)
        setSkipHotkey(config.skipHotkey)
        setBackHotkey(config.backHotkey)
        setDarkMode(config.darkMode)
        setDefaultProjectLocation(config.defaultProjectLocation || '')
        setExportFormat(config.exportFormat || 'pdf')
        setExportTemplate(config.exportTemplate || 'default')
        setScreenshotFormat(config.screenshotFormat || 'png')
        setScreenshotQuality(config.screenshotQuality ?? 90)
        setLocalOnly(config.localOnly || false)
        setEncryptProjects(config.encryptProjects || false)
        setEncryptionPassphrase(config.encryptionPassphrase || '')
      } catch (e) {
        console.error("Failed to load config", e)
      } finally {
        setIsLoading(false)
      }
      try {
        const health = await window.electronAPI.getBackendHealth()
        setBackendStatus(health ? `online (${health.provider}, AI ${health.ai_configured ? 'ready' : 'no key'})` : 'offline')
      } catch {
        setBackendStatus('offline')
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    try {
      if (encryptProjects && !encryptionPassphrase.trim()) {
        toast({ variant: 'error', title: 'Passphrase required', description: 'Set a passphrase to enable project encryption.' })
        return
      }
      const config = {
        ...(baseConfig || {}),
        apiKey, provider, captureHotkey, skipHotkey, backHotkey, darkMode,
        defaultProjectLocation, exportFormat, exportTemplate,
        screenshotFormat, screenshotQuality, localOnly,
        encryptProjects, encryptionPassphrase,
      }
      await window.electronAPI.saveConfig(config as any)
      document.documentElement.classList.toggle('dark', darkMode)
      toast({ variant: 'success', title: 'Settings saved', description: 'Your preferences have been updated.' })
      navigate('/')
    } catch (e) {
      console.error("Failed to save settings", e)
      toast({ variant: 'error', title: 'Could not save settings', description: e instanceof Error ? e.message : String(e) })
    }
  }

  const handleReset = () => {
    setApiKey('')
    setProvider('mistral')
    setCaptureHotkey('CommandOrControl+Shift+S')
    setSkipHotkey('CommandOrControl+Shift+N')
    setBackHotkey('CommandOrControl+Shift+B')
    setDarkMode(false)
    setDefaultProjectLocation('')
    setExportFormat('pdf')
    setExportTemplate('default')
    setScreenshotFormat('png')
    setScreenshotQuality(90)
    setLocalOnly(false)
    setEncryptProjects(false)
    setEncryptionPassphrase('')
  }

  const handlePickLocation = async () => {
    const result = await window.electronAPI.pickDirectory()
    if (result.success && result.path) setDefaultProjectLocation(result.path)
  }

  const handleRestartBackend = async () => {
    setBackendStatus('restarting...')
    await window.electronAPI.restartBackend()
    const health = await window.electronAPI.getBackendHealth()
    setBackendStatus(health ? `online (${health.provider})` : 'offline')
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
          <h1 className="text-3xl font-bold gradient-text">Settings</h1>
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
                  <Label htmlFor="provider">AI Provider</Label>
                  <select
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="mistral">Mistral AI</option>
                    <option value="openai">OpenAI (requires openai package)</option>
                  </select>
                </div>
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
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Backend status</Label>
                    <p className="text-sm text-muted-foreground">{backendStatus}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRestartBackend} className="gap-2">
                    <Loader2 className="h-4 w-4" /> Restart
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Storage */}
            <Card className="glass mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Storage
                </CardTitle>
                <CardDescription>Where projects and screenshots are stored</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="loc">Default project location</Label>
                <div className="flex items-center gap-2">
                  <Input id="loc" value={defaultProjectLocation} onChange={(e) => setDefaultProjectLocation(e.target.value)} placeholder="Default app data folder" className="flex-1" />
                  <Button variant="outline" onClick={handlePickLocation} className="gap-2">
                    <FolderOpen className="h-4 w-4" /> Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Leave blank to use the default app data folder.</p>
              </CardContent>
            </Card>

            {/* Export defaults */}
            <Card className="glass mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileOutput className="h-5 w-5" />
                  Export Defaults
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ef">Default format</Label>
                  <select id="ef" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                    <option value="tex">LaTeX</option>
                    <option value="md">Markdown</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="et">Default template</Label>
                  <select id="et" value={exportTemplate} onChange={(e) => setExportTemplate(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="default">Default</option>
                    <option value="minimal">Minimal</option>
                    <option value="detailed">Detailed</option>
                    <option value="academic">Academic</option>
                    <option value="business">Business</option>
                    <option value="runbook">Runbook</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Screenshot quality */}
            <Card className="glass mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Screenshot Quality
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sf">Format</Label>
                    <select id="sf" value={screenshotFormat} onChange={(e) => setScreenshotFormat(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="png">PNG (lossless)</option>
                      <option value="jpg">JPG (smaller)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sq">JPG Quality: {screenshotQuality}</Label>
                    <input id="sq" type="range" min={40} max={100} value={screenshotQuality} onChange={(e) => setScreenshotQuality(Number(e.target.value))} className="w-full" disabled={screenshotFormat !== 'jpg'} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Privacy */}
            <Card className="glass mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Privacy
                </CardTitle>
                <CardDescription>Control whether screenshots are sent to cloud AI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="localOnly">Local-only mode</Label>
                    <p className="text-sm text-muted-foreground">Disable AI features that upload screenshots</p>
                  </div>
                  <Switch id="localOnly" checked={localOnly} onCheckedChange={setLocalOnly} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="encrypt">Encrypt projects at rest</Label>
                    <p className="text-sm text-muted-foreground">AES-256 encrypt project manifests using a passphrase</p>
                  </div>
                  <Switch id="encrypt" checked={encryptProjects} onCheckedChange={setEncryptProjects} />
                </div>
                {encryptProjects && (
                  <div className="space-y-2">
                    <Label htmlFor="passphrase">Encryption passphrase</Label>
                    <Input
                      id="passphrase"
                      type="password"
                      value={encryptionPassphrase}
                      onChange={(e) => setEncryptionPassphrase(e.target.value)}
                      placeholder="Enter a passphrase"
                    />
                    <p className="text-xs text-amber-400">
                      Keep this safe — encrypted projects cannot be opened without it. Existing projects are encrypted the next time they're saved.
                    </p>
                  </div>
                )}
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
          value={value.replace('CommandOrControl', 'Ctrl')} 
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

