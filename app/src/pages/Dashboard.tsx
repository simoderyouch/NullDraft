import { useNavigate } from 'react-router-dom'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FolderOpen, Settings, Upload, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import logo from '@/assets/h-logo.svg'

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
  const [isDragging, setIsDragging] = useState(false)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
  }, [])

  const handleDeleteProject = async (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation() // Prevent card click
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        const result = await window.electronAPI.deleteProject(projectPath)
        if (result.success) {
          setRecentProjects(prev => prev.filter(p => p.path !== projectPath))
        } else {
          console.error('Failed to delete project:', result.error)
          alert('Failed to delete project: ' + result.error)
        }
      } catch (error) {
        console.error('Error deleting project:', error)
        alert('An error occurred while deleting the project.')
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
    // TODO: Handle file drop logic
    console.log('File dropped')
    navigate('/review')
  }

  const handleFileSelect = () => {
    // TODO: Implement file selection logic
    navigate('/review')
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <img src={logo} alt="NullDraft Logo" className=" h-[10rem] mx-auto mb-2" />
          <p className="text-lg text-muted-foreground">
            Turn instructions into step-by-step screenshot documentation
          </p>
        </div>

        {/* Primary Actions */}
        <div className="flex justify-center gap-4 mb-12">
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
          >
            <FolderOpen className="mr-2 h-5 w-5" />
            Open Existing
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
                  <span className="px-2 py-1 bg-muted rounded">.pdf</span>
                  <span className="px-2 py-1 bg-muted rounded">.docx</span>
                  <span className="px-2 py-1 bg-muted rounded">.txt</span>
                  <span className="px-2 py-1 bg-muted rounded">.tex</span>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Projects */}
        {!isLoading && recentProjects.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/edit?project=${encodeURIComponent(project.path)}`)}
                >
                  <CardHeader className="relative pr-12">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
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

