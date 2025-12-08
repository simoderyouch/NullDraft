import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FolderOpen, Settings, Upload } from 'lucide-react'
import { motion } from 'framer-motion'

interface RecentProject {
  id: string
  name: string
  lastModified: string
  stepCount: number
}

const mockRecentProjects: RecentProject[] = [
  { id: '1', name: 'User Guide Documentation', lastModified: '2 days ago', stepCount: 12 },
  { id: '2', name: 'API Tutorial Steps', lastModified: '1 week ago', stepCount: 8 },
  { id: '3', name: 'Installation Guide', lastModified: '2 weeks ago', stepCount: 15 },
  { id: '4', name: 'Feature Walkthrough', lastModified: '3 weeks ago', stepCount: 6 },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [isDragging, setIsDragging] = useState(false)

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
          <h1 className="text-5xl font-bold text-foreground mb-4">NullDraft</h1>
          <p className="text-lg text-muted-foreground">
            Turn instructions into step-by-step screenshot documentation
          </p>
        </div>

        {/* Primary Actions */}
        <div className="flex justify-center gap-4 mb-12">
          <Button
            size="lg"
            onClick={handleFileSelect}
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
            className={`glass border-2 border-dashed transition-all cursor-pointer ${
              isDragging
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
        {mockRecentProjects.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Recent Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockRecentProjects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/review')}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription>
                      {project.stepCount} steps • {project.lastModified}
                    </CardDescription>
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

