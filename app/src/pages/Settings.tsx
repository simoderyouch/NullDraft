import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Save, RotateCcw, Key, Keyboard, Palette, FolderOpen, FileOutput, Camera, ShieldCheck, Loader2, Languages, LogOut, UserRound, UserPlus, ChevronDown, Check } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { LANGUAGE_OPTIONS, languageNameForCode } from '@/lib/language'

const PROVIDER_DETAILS: Record<string, { label: string; keyName: string; placeholder: string }> = {
  mistral: { label: 'Mistral AI', keyName: 'Mistral API key', placeholder: 'Enter your Mistral API key' },
  openai: { label: 'OpenAI', keyName: 'OpenAI API key', placeholder: 'Enter your OpenAI API key' },
  anthropic: { label: 'Anthropic Claude', keyName: 'Anthropic API key', placeholder: 'Enter your Anthropic API key' },
  gemini: { label: 'Google Gemini', keyName: 'Gemini API key', placeholder: 'Enter your Gemini API key' },
}

export default function Settings() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState('mistral')
  const [captureHotkey, setCaptureHotkey] = useState('CommandOrControl+Shift+S')
  const [skipHotkey, setSkipHotkey] = useState('CommandOrControl+Shift+N')
  const [backHotkey, setBackHotkey] = useState('CommandOrControl+Shift+B')
  const [backgroundOpacity, setBackgroundOpacity] = useState(70)
  const [defaultProjectLocation, setDefaultProjectLocation] = useState('')
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exportTemplate, setExportTemplate] = useState('default')
  const [screenshotFormat, setScreenshotFormat] = useState('png')
  const [screenshotQuality, setScreenshotQuality] = useState(90)
  const [languageMode, setLanguageMode] = useState<'auto' | 'manual'>('auto')
  const [languageCode, setLanguageCode] = useState('en')
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileRole, setProfileRole] = useState('user')
  const [profileSyncStatus, setProfileSyncStatus] = useState('Connected')
  const [isCloudConnected, setIsCloudConnected] = useState(false)
  const [cloudSyncProjects, setCloudSyncProjects] = useState(false)
  const [isProfileBusy, setIsProfileBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [invitations, setInvitations] = useState<CloudInvitation[]>([])
  const [managedUsers, setManagedUsers] = useState<CloudUser[]>([])
  const [isInviteBusy, setIsInviteBusy] = useState(false)
  const [localOnly, setLocalOnly] = useState(false)
  const [encryptProjects, setEncryptProjects] = useState(false)
  const [encryptionPassphrase, setEncryptionPassphrase] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [backendStatus, setBackendStatus] = useState<string>('checking...')
  const [baseConfig, setBaseConfig] = useState<AppConfig | null>(null)
  const providerDetails = PROVIDER_DETAILS[provider] || PROVIDER_DETAILS.mistral

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
        setBackgroundOpacity(config.backgroundOpacity ?? 70)
        setDefaultProjectLocation(config.defaultProjectLocation || '')
        setExportFormat(config.exportFormat || 'pdf')
        setExportTemplate(config.exportTemplate || 'default')
        setScreenshotFormat(config.screenshotFormat || 'png')
        setScreenshotQuality(config.screenshotQuality ?? 90)
        setLanguageMode(config.languageMode || 'auto')
        setLanguageCode(config.languageCode || 'en')
        setProfileName(config.cloudUserName || '')
        setProfileEmail(config.cloudUserEmail || '')
        setProfileRole(config.cloudUserRole || 'user')
        setProfileSyncStatus(config.cloudLastSyncStatus || 'Connected')
        setCloudSyncProjects(config.cloudSyncProjects || false)
        setLocalOnly(config.localOnly || false)
        setEncryptProjects(config.encryptProjects || false)
        setEncryptionPassphrase(config.encryptionPassphrase || '')
        try {
          const status = await window.electronAPI.getCloudAccountStatus()
          if (status.connected && status.user) {
            setIsCloudConnected(true)
            setProfileName(status.user.name)
            setProfileEmail(status.user.email)
            setProfileRole(status.user.role)
            setProfileSyncStatus(status.lastSyncStatus || 'Connected')
            if (status.user.role === 'admin') {
              const invitationResult = await window.electronAPI.cloudListInvitations()
              if (invitationResult.success) setInvitations(invitationResult.invitations)
              const usersResult = await window.electronAPI.cloudListUsers()
              if (usersResult.success) setManagedUsers(usersResult.users)
            }
          }
        } catch {
          // keep local cached profile values
        }
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
        apiKey, provider, captureHotkey, skipHotkey, backHotkey, darkMode: true, backgroundOpacity,
        defaultProjectLocation, exportFormat, exportTemplate,
        screenshotFormat, screenshotQuality, localOnly,
        languageMode, languageCode, languageName: languageNameForCode(languageCode),
        cloudEnabled: baseConfig?.cloudEnabled ?? false,
        requireCloudAccess: baseConfig?.requireCloudAccess ?? false,
        cloudApiUrl: baseConfig?.cloudApiUrl || 'http://127.0.0.1:8010',
        cloudAccessToken: baseConfig?.cloudAccessToken || '',
        cloudSyncProjects,
        cloudSyncConsentVersion: 1,
        cloudUploadAssets: baseConfig?.cloudUploadAssets || false,
        cloudUserEmail: baseConfig?.cloudUserEmail || '',
        cloudUserName: baseConfig?.cloudUserName || '',
        cloudUserRole: baseConfig?.cloudUserRole || '',
        cloudLastSyncStatus: baseConfig?.cloudLastSyncStatus || '',
        cloudLastSyncAt: baseConfig?.cloudLastSyncAt || '',
        encryptProjects, encryptionPassphrase,
      }
      await window.electronAPI.saveConfig(config as any)
      document.documentElement.classList.add('dark')
      document.documentElement.style.setProperty('--app-background-opacity', String(backgroundOpacity / 100))
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
    setBackgroundOpacity(70)
    document.documentElement.style.setProperty('--app-background-opacity', '0.7')
    setDefaultProjectLocation('')
    setExportFormat('pdf')
    setExportTemplate('default')
    setScreenshotFormat('png')
    setScreenshotQuality(90)
    setLanguageMode('auto')
    setLanguageCode('en')
    setProfileName('')
    setProfileEmail('')
    setProfileRole('user')
    setProfileSyncStatus('Connected')
    setIsCloudConnected(false)
    setCloudSyncProjects(false)
    setLocalOnly(false)
    setEncryptProjects(false)
    setEncryptionPassphrase('')
  }

  const handleBackgroundOpacityChange = (value: number) => {
    setBackgroundOpacity(value)
    document.documentElement.style.setProperty('--app-background-opacity', String(value / 100))
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

  const handleProfileSave = async () => {
    setIsProfileBusy(true)
    try {
      const result = await window.electronAPI.cloudUpdateProfile({ name: profileName })
      if (!result.success || !result.user) throw new Error(result.error || 'Could not update profile')
      setProfileName(result.user.name)
      setProfileEmail(result.user.email)
      setProfileRole(result.user.role)
      setBaseConfig((prev) => prev ? { ...prev, cloudUserName: result.user!.name, cloudUserEmail: result.user!.email, cloudUserRole: result.user!.role } : prev)
      toast({ variant: 'success', title: 'Profile updated' })
    } catch (e) {
      toast({ variant: 'error', title: 'Profile update failed', description: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsProfileBusy(false)
    }
  }

  const handleLogout = async () => {
    await window.electronAPI.cloudLogout()
    setIsCloudConnected(false)
    setProfileName('')
    setProfileEmail('')
    setProfileRole('user')
    setProfileSyncStatus('Disconnected')
    navigate('/', { replace: true })
  }

  const refreshInvitations = async () => {
    const result = await window.electronAPI.cloudListInvitations()
    if (result.success) setInvitations(result.invitations)
  }

  const refreshManagedUsers = async () => {
    const result = await window.electronAPI.cloudListUsers()
    if (result.success) setManagedUsers(result.users)
  }

  const handleCreateInvitation = async () => {
    setIsInviteBusy(true)
    try {
      const result = await window.electronAPI.cloudCreateInvitation({ email: inviteEmail, name: inviteName || undefined })
      if (!result.success || !result.activation_url) throw new Error(result.error || 'Could not create invitation')
      setInviteLink(result.activation_url)
      setInviteEmail('')
      setInviteName('')
      await refreshInvitations()
      toast({ variant: 'success', title: 'Invitation created', description: 'Copy the one-time link and send it only to the invited person.' })
    } catch (error) {
      toast({ variant: 'error', title: 'Invitation failed', description: error instanceof Error ? error.message : String(error) })
    } finally {
      setIsInviteBusy(false)
    }
  }

  const handleOpenAdminConsole = async () => {
    const result = await window.electronAPI.cloudOpenAdminConsole()
    if (!result.success) toast({ variant: 'error', title: 'Could not open admin console', description: result.error || 'Try again later.' })
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    setIsInviteBusy(true)
    try {
      const result = await window.electronAPI.cloudRevokeInvitation(invitationId)
      if (!result.success) throw new Error(result.error || 'Could not revoke invitation')
      await refreshInvitations()
      toast({ variant: 'success', title: 'Invitation revoked' })
    } catch (error) {
      toast({ variant: 'error', title: 'Revoke failed', description: error instanceof Error ? error.message : String(error) })
    } finally {
      setIsInviteBusy(false)
    }
  }

  const handleRevokeUserAccess = async (userId: string) => {
    setIsInviteBusy(true)
    try {
      const result = await window.electronAPI.cloudRevokeUserAccess(userId)
      if (!result.success) throw new Error(result.error || 'Could not revoke access')
      await refreshManagedUsers()
      toast({ variant: 'success', title: 'User access revoked' })
    } catch (error) {
      toast({ variant: 'error', title: 'Revoke failed', description: error instanceof Error ? error.message : String(error) })
    } finally {
      setIsInviteBusy(false)
    }
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
            {/* Optional cloud account */}
            <Card className="glass mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-5 w-5" />
                  Optional Cloud Account
                </CardTitle>
                <CardDescription>NullDraft works locally and offline. Connect only to use invitations, access management, or project sync.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isCloudConnected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">No cloud account is connected. Your projects stay on this computer.</p>
                    <Button type="button" variant="outline" onClick={() => navigate('/auth')} className="gap-2">
                      <UserRound className="h-4 w-4" />
                      Connect cloud account
                    </Button>
                  </div>
                ) : <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profileName">Name</Label>
                      <Input id="profileName" value={profileName} onChange={(e) => setProfileName(e.target.value)} disabled={isProfileBusy} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profileEmail">Email</Label>
                      <Input id="profileEmail" value={profileEmail} disabled />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>Role: {profileRole}</div>
                    <div>Cloud: {profileSyncStatus}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="cloudSyncProjects">Sync project manifests</Label>
                      <p className="text-sm text-muted-foreground">Off by default. Screenshots and report files are never uploaded.</p>
                    </div>
                    <Switch id="cloudSyncProjects" checked={cloudSyncProjects} onCheckedChange={setCloudSyncProjects} />
                  </div>
                  <p className="text-xs text-muted-foreground">Save settings to apply the sync choice.</p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleProfileSave} disabled={isProfileBusy || !profileName} className="gap-2">
                      {isProfileBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Profile
                    </Button>
                    <Button type="button" variant="outline" onClick={handleLogout} className="gap-2">
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </>}
              </CardContent>
            </Card>

            {profileRole === 'admin' && (
              <Card className="glass mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invitations</CardTitle>
                  <CardDescription>Create and revoke one-time activation links. Anyone with an active link can activate it, so send links privately.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button type="button" variant="outline" onClick={handleOpenAdminConsole}>Open secure web admin console</Button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inviteEmail">Invitee email</Label>
                      <Input id="inviteEmail" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@example.com" disabled={isInviteBusy} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inviteName">Name (optional)</Label>
                      <Input id="inviteName" value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Person's name" disabled={isInviteBusy} />
                    </div>
                  </div>
                  <Button type="button" onClick={handleCreateInvitation} disabled={isInviteBusy || !inviteEmail.trim()} className="gap-2">
                    {isInviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Create invitation
                  </Button>
                  {inviteLink && (
                    <div className="space-y-2">
                      <Label htmlFor="inviteLink">New activation link</Label>
                      <Input id="inviteLink" value={inviteLink} readOnly onFocus={(event) => event.currentTarget.select()} />
                      <p className="text-xs text-amber-400">This link is only shown once. Copy it now; it expires in 72 hours or after activation.</p>
                    </div>
                  )}
                  {invitations.filter((invitation) => !invitation.used_at && !invitation.revoked_at).length > 0 && (
                    <div className="space-y-2 pt-2">
                      <Label>Active invitations</Label>
                      {invitations.filter((invitation) => !invitation.used_at && !invitation.revoked_at).slice(0, 10).map((invitation) => (
                        <div key={invitation.id} className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm">
                            <div>{invitation.name || invitation.email} <span className="text-muted-foreground">({invitation.email})</span></div>
                            <div className="text-xs text-muted-foreground">Expires {new Date(invitation.expires_at).toLocaleString()}</div>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleRevokeInvitation(invitation.id)} disabled={isInviteBusy}>Revoke</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {managedUsers.some((user) => !user.access_revoked_at) && (
                    <div className="space-y-2 pt-2">
                      <Label>Active accounts</Label>
                      {managedUsers.filter((user) => !user.access_revoked_at).slice(0, 20).map((user) => (
                        <div key={user.id} className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm">
                            <div>{user.name} <span className="text-muted-foreground">({user.email})</span></div>
                            <div className="text-xs text-muted-foreground">{user.role}{user.last_seen_at ? ` · Last seen ${new Date(user.last_seen_at).toLocaleString()}` : ''}</div>
                          </div>
                          {user.email !== profileEmail && (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleRevokeUserAccess(user.id)} disabled={isInviteBusy}>Revoke access</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                  <SettingsSelect
                    id="provider"
                    value={provider}
                    onValueChange={setProvider}
                    options={[
                      { value: 'mistral', label: 'Mistral AI' },
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'anthropic', label: 'Anthropic Claude' },
                      { value: 'gemini', label: 'Google Gemini' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{providerDetails.keyName}</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={providerDetails.placeholder}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your key is stored locally and only sent to {providerDetails.label} for AI requests.
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
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ef">Default format</Label>
                  <SettingsSelect
                    id="ef"
                    value={exportFormat}
                    onValueChange={setExportFormat}
                    options={[
                      { value: 'pdf', label: 'PDF' },
                      { value: 'docx', label: 'DOCX' },
                      { value: 'tex', label: 'LaTeX' },
                      { value: 'md', label: 'Markdown' },
                      { value: 'json', label: 'JSON' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="et">Default template</Label>
                  <SettingsSelect
                    id="et"
                    value={exportTemplate}
                    onValueChange={setExportTemplate}
                    options={[
                      { value: 'default', label: 'Default' },
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'detailed', label: 'Detailed' },
                      { value: 'academic', label: 'Academic' },
                      { value: 'business', label: 'Business' },
                      { value: 'runbook', label: 'Runbook' },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Language */}
            <Card className="glass mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Language
                </CardTitle>
                <CardDescription>
                  Control the language used for steps, captions, explanations, narrative, and reports
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="languageMode">Mode</Label>
                  <SettingsSelect
                    id="languageMode"
                    value={languageMode}
                    onValueChange={(value) => setLanguageMode(value as 'auto' | 'manual')}
                    options={[
                      { value: 'auto', label: 'Auto-detect from document' },
                      { value: 'manual', label: 'Use selected language' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="languageCode">Language</Label>
                  <SettingsSelect
                    id="languageCode"
                    value={languageCode}
                    onValueChange={setLanguageCode}
                    disabled={languageMode === 'auto'}
                    options={LANGUAGE_OPTIONS.map((language) => ({ value: language.code, label: language.name }))}
                  />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sf">Format</Label>
                    <SettingsSelect
                      id="sf"
                      value={screenshotFormat}
                      onValueChange={setScreenshotFormat}
                      options={[
                        { value: 'png', label: 'PNG (lossless)' },
                        { value: 'jpg', label: 'JPG (smaller)' },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sq">JPG Quality: {screenshotQuality}</Label>
                    <SettingsSlider
                      id="sq"
                      min={40}
                      max={100}
                      value={screenshotQuality}
                      onChange={setScreenshotQuality}
                      disabled={screenshotFormat !== 'jpg'}
                    />
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
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="backgroundOpacity">Background opacity</Label>
                      <p className="text-sm text-muted-foreground">Controls how much of the desktop shows through the app background.</p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{backgroundOpacity}%</span>
                  </div>
                  <SettingsSlider
                    id="backgroundOpacity"
                    min={10}
                    max={90}
                    value={backgroundOpacity}
                    onChange={handleBackgroundOpacityChange}
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

type SettingsSelectOption = {
  value: string
  label: string
}

function SettingsSelect({
  id,
  value,
  onValueChange,
  options,
  disabled = false,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  options: SettingsSelectOption[]
  disabled?: boolean
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
    if (disabled) return

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
    <div ref={selectRef} className="settings-select relative" data-open={isOpen}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleKeyDown}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background/80 px-3 text-left text-sm text-foreground shadow-inner shadow-slate-900/5 transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:bg-white/[0.06] dark:shadow-black/10 dark:hover:border-white/25 dark:hover:bg-white/[0.1]"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`ml-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-[70] mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover/95 p-1.5 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-white/15 dark:bg-[hsl(222_44%_12%_/_0.98)] dark:shadow-black/45"
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => chooseOption(option.value)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${isSelected
                  ? 'bg-primary/15 text-primary dark:bg-primary/20 dark:text-white'
                  : 'text-muted-foreground hover:bg-primary/8 hover:text-primary dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SettingsSlider({
  id,
  min,
  max,
  value,
  onChange,
  disabled = false,
}: {
  id: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const progress = ((value - min) / (max - min)) * 100

  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      disabled={disabled}
      className="settings-slider"
      style={{ '--slider-progress': `${progress}%` } as React.CSSProperties}
    />
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
