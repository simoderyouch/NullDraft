import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { Home, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <aside className="w-64 bg-card border-r border-border p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">NullDraft</h1>
        <p className="text-sm text-muted-foreground">Screenshot Documentation</p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Button
              key={item.path}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start',
                isActive && 'bg-secondary'
              )}
              onClick={() => navigate(item.path)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}

