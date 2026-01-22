import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Download, FileText, FileCode, FileType, File } from 'lucide-react'

type ExportFormat = 'docx' | 'tex' | 'md' | 'pdf'

const formatOptions = [
  { value: 'docx' as ExportFormat, label: 'DOCX', icon: FileText, description: 'Microsoft Word document' },
  { value: 'tex' as ExportFormat, label: 'LaTeX', icon: FileCode, description: 'LaTeX source file' },
  { value: 'md' as ExportFormat, label: 'Markdown', icon: FileType, description: 'Markdown file' },
  { value: 'pdf' as ExportFormat, label: 'PDF', icon: File, description: 'Portable Document Format' },
]

export default function Export() {
  const navigate = useNavigate()
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('docx')
  const [fileName, setFileName] = useState('documentation')
  const [selectedTemplate, setSelectedTemplate] = useState('default')

  const handleExport = () => {
    // TODO: Implement export logic
    console.log('Exporting:', { format: selectedFormat, fileName, template: selectedTemplate })
  }

  const selectedFormatInfo = formatOptions.find((opt) => opt.value === selectedFormat)

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {/* <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>*/}
          <h1 className="text-3xl font-bold mx-auto">Generate Document</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>

        {/* Export Options */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle>Export Format</CardTitle>
            <CardDescription>
              Choose the format for your documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as ExportFormat)}>
              <TabsList className="grid w-full grid-cols-4">
                {formatOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <TabsTrigger key={option.value} value={option.value} className="flex flex-col gap-2 h-auto py-3">
                      <Icon className="h-5 w-5" />
                      <span>{option.label}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
              {formatOptions.map((option) => (
                <TabsContent key={option.value} value={option.value} className="mt-4">
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* File Name */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle>File Name</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="fileName">Output file name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="fileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">
                  .{selectedFormat}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Preview: <code className="bg-muted px-1 rounded">{fileName}.{selectedFormat}</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Template Selection */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>
              Select a template for your document
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="template">Document template</Label>
              <select
                id="template"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="default">Default Template</option>
                <option value="minimal">Minimal</option>
                <option value="detailed">Detailed</option>
                <option value="academic">Academic</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Export Button */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            size="lg"
            className="gap-2"
          >
            <Download className="h-5 w-5" />
            Export Document
          </Button>
        </div>
      </div>
    </div>
  )
}

