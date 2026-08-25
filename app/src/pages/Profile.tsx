import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, LogOut, Save, UserRound } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export default function Profile() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [syncStatus, setSyncStatus] = useState('')
  const [isBusy, setIsBusy] = useState(true)

  const load = useCallback(async () => {
    setIsBusy(true)
    try {
      const status = await window.electronAPI.getCloudAccountStatus()
      if (!status.connected || !status.user) {
        navigate('/auth', { replace: true })
        return
      }
      setName(status.user.name)
      setEmail(status.user.email)
      setRole(status.user.role)
      setSyncStatus(status.lastSyncStatus || 'Connected')
    } finally {
      setIsBusy(false)
    }
  }, [navigate])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setIsBusy(true)
    try {
      const result = await window.electronAPI.cloudUpdateProfile({ name })
      if (!result.success || !result.user) throw new Error(result.error || 'Could not update profile')
      setName(result.user.name)
      toast({ variant: 'success', title: 'Profile updated' })
    } catch (error) {
      toast({ variant: 'error', title: 'Update failed', description: error instanceof Error ? error.message : String(error) })
    } finally {
      setIsBusy(false)
    }
  }

  const logout = async () => {
    await window.electronAPI.cloudLogout()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
          <h1 className="text-3xl font-bold gradient-text">Profile</h1>
          <div className="w-20" />
        </div>
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Personal Profile</CardTitle>
            <CardDescription>Manage your account and sync status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isBusy} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>Role: {role}</div>
              <div>Sync: {syncStatus || 'Connected'}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={isBusy || !name} className="gap-2">{isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
              <Button variant="outline" onClick={logout} className="gap-2"><LogOut className="h-4 w-4" /> Logout</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
