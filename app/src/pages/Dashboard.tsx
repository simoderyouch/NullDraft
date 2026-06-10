import { useNavigate } from 'react-router-dom'
import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FolderOpen, Settings, Upload, Trash2, LayoutTemplate, FilePlus2, RotateCcw, X } from 'lucide-react'
import { motion } from 'framer-motion'
import logo from '@/assets/h-logo.svg'
import { PROJECT_TEMPLATES } from '@/lib/templates'
import { useToast } from '@/components/ui/toast'

interface RecentProject {
  id: string
  name: string
  path: string
  lastModified: string
  stepCount: number
}

// Helper function to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isDragging, setIsDragging] = useState(false)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [recovery, setRecovery] = useState<{ projectPath: string; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load recent projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const result = await window.electronAPI.getRecentProjects()
        if (result.success) {
          setRecentProjects(result.projects)
        }
      } catch (error) {
        console.error('Failed to load recent projects:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadProjects()

    // Crash recovery: check for an interrupted capture session.
    window.electronAPI.getRecoveryInfo().then((info) => {
      if (info?.recover && info.projectPath) {
        setRecovery({ projectPath: info.projectPath, name: info.name || 'Untitled' })
      }
    }).catch(() => {})
  }, [])

  const handleResume = () => {
    if (recovery) {
      window.electronAPI.clearActiveSession()
      navigate(`/review?project=${encodeURIComponent(recovery.projectPath)}`)
    }
  }

  const handleDismissRecovery = () => {
    window.electronAPI.clearActiveSession()
    setRecovery(null)
  }

  const handleDeleteProject = async (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation() // Prevent card click
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        const result = await window.electronAPI.deleteProject(projectPath)
        if (result.success) {
          setRecentProjects(prev => prev.filter(p => p.path !== projectPath))
          toast({ variant: 'success', title: 'Project deleted' })
        } else {
          console.error('Failed to delete project:', result.error)
          toast({ variant: 'error', title: 'Delete failed', description: result.error })
        }
      } catch (error) {
        console.error('Error deleting project:', error)
        toast({ variant: 'error', title: 'Delete failed', description: 'An error occurred while deleting the project.' })
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      navigate('/create', { state: { droppedFile: file } })
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      navigate('/create', { state: { droppedFile: file } })
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-up">
          <img src={logo} alt="NullDraft Logo" className="h-[10rem] mx-auto mb-2 animate-float" />
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Turn instructions into polished, screenshot-rich technical documents
          </p>
        </div>

        {/* Crash recovery banner */}
        {recovery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 text-amber-400" />
              <div>
                <p className="font-medium">Resume interrupted session?</p>
                <p className="text-sm text-muted-foreground">
                  Capture was in progress for "{recovery.name}" when the app last closed.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleResume} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Resume
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismissRecovery}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Primary Actions */}
        <div className="flex justify-center flex-wrap gap-4 mb-12 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <Button
            size="lg"
            onClick={() => navigate('/create')}
            className="h-12 px-6"
          >
            <FileText className="mr-2 h-5 w-5" />
            New Project
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-6"
            onClick={() => {
              if (recentProjects.length > 0) {
                navigate(`/edit?project=${encodeURIComponent(recentProjects[0].path)}`)
              } else {
                handleFileSelect()
              }
            }}
          >
            <FolderOpen className="mr-2 h-5 w-5" />
            Open Existing
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/enhance')}
            className="h-12 px-6"
          >
            <FilePlus2 className="mr-2 h-5 w-5" />
            Enhance Document
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate('/settings')}
            className="h-12 px-6"
          >
            <Settings className="mr-2 h-5 w-5" />
            Settings
          </Button>
        </div>

        {/* Drag and Drop Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card
            className={` border-2 border-dashed transition-all cursor-pointer ${isDragging
              ? 'border-primary bg-primary/5 scale-105'
              : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileSelect}
          >
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".txt,.md,.pdf,.docx,.tex"
            />
            <CardContent className="p-16 text-center">
              <motion.div
                animate={{ y: isDragging ? -5 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-semibold mb-2">
                  Drop your instruction file here
                </h3>
                <p className="text-muted-foreground mb-4">
                  or click to browse
                </p>
                <div className="flex justify-center gap-2 text-sm text-muted-foreground">
                  {['.pdf', '.docx', '.txt', '.tex'].map((ext) => (
                    <span key={ext} className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 font-mono text-xs">{ext}</span>
                  ))}
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Templates Library */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-primary" /> Start from a template
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROJECT_TEMPLATES.map((tpl) => (
              <Card
                key={tpl.id}
                className="cursor-pointer card-hover"
                onClick={() => navigate('/create', { state: { templateSteps: tpl.steps, templateName: tpl.name } })}
              >
                <CardHeader>
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                  <CardDescription>{tpl.description}</CardDescription>
                  <p className="text-xs text-muted-foreground mt-2">{tpl.steps.length} steps</p>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Projects */}
        {!isLoading && recentProjects.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer card-hover group"
                  onClick={() => navigate(`/edit?project=${encodeURIComponent(project.path)}`)}
                >
                  <CardHeader className="relative pr-12">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{project.name}</CardTitle>
                    <CardDescription>
                      {project.stepCount} steps • {formatRelativeTime(project.lastModified)}
                    </CardDescription>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-4 h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteProject(e, project.path)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

