import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, Loader2 } from 'lucide-react'
import logo from '@/assets/h-logo.svg'
import { useToast } from '@/components/ui/toast'

export default function Auth() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [apiUrl, setApiUrl] = useState('')
  const [invitation, setInvitation] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg) => {
      setApiUrl(cfg.cloudApiUrl)
      if (cfg.cloudAccessToken) navigate('/', { replace: true })
    }).catch(() => {})

    window.electronAPI.getPendingInvitation().then((token) => {
      if (token) setInvitation(token)
    }).catch(() => {})
    window.electronAPI.onInvitationLink((token) => setInvitation(token))
    return () => window.electronAPI.removeInvitationLinkListener()
  }, [navigate])

  const activate = async () => {
    setIsBusy(true)
    try {
      const result = await window.electronAPI.cloudAcceptInvitation({ apiUrl, invitation })
      if (!result.success || !result.user) throw new Error(result.error || 'Could not activate this invitation')
      toast({ variant: 'success', title: 'NullDraft activated', description: `Welcome, ${result.user.name}` })
      navigate('/', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({
        variant: 'error',
        title: 'Activation failed',
        description: message.includes('fetch failed')
          ? `Cannot reach ${apiUrl}. Check that the cloud service is running.`
          : message,
      })
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="glass w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="NullDraft" className="h-28 mx-auto mb-2" />
          <CardTitle className="text-white">Connect to NullDraft Cloud</CardTitle>
          <CardDescription>Cloud access is optional unless your organization uses an invite-only edition.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invitation">Invitation link or code</Label>
            <Input
              id="invitation"
              value={invitation}
              onChange={(event) => setInvitation(event.target.value)}
              placeholder="nulldraft://activate?token=..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Open your invitation link or paste it here. Invitations can only be used once.</p>
          </div>
          <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">Cloud access enables invitations and optional project-manifest sync. Your local capture and export workflow stays available without it.</p>
          <Button className="w-full gap-2" onClick={activate} disabled={isBusy || !invitation.trim() || !apiUrl.trim()}>
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Activate invitation
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/')}>Continue using NullDraft locally</Button>
        </CardContent>
      </Card>
    </div>
  )
}
