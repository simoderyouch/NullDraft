import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Download, FileText, FileCode, FileType, File, FileJson, Sparkles, FolderOpen, Loader2, CheckCircle2, Image as ImageIcon, X } from 'lucide-react'
import { ProjectLanguage, Step } from '@/lib/projectTypes'
import { generateReport, generateScreenshotDescription, generateCaptions } from '@/lib/api'
import { resolveConfiguredLanguage } from '@/lib/language'
import { useToast } from '@/components/ui/toast'
import WorkflowSteps from '@/components/WorkflowSteps'

type ExportFormat = 'docx' | 'tex' | 'md' | 'pdf' | 'json'

const formatOptions = [
  { value: 'pdf' as ExportFormat, label: 'PDF', icon: File, description: 'Portable Document Format (via LibreOffice)' },
  { value: 'docx' as ExportFormat, label: 'DOCX', icon: FileText, description: 'Microsoft Word document' },
  { value: 'tex' as ExportFormat, label: 'LaTeX', icon: FileCode, description: 'LaTeX source file' },
  { value: 'md' as ExportFormat, label: 'Markdown', icon: FileType, description: 'Markdown file' },
  { value: 'json' as ExportFormat, label: 'JSON', icon: FileJson, description: 'JSON manifest for automation' },
]

export default function Export() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const projectPathFromQuery = searchParams.get('project')

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf')
  const [fileName, setFileName] = useState('documentation')
  const [selectedTemplate, setSelectedTemplate] = useState('default')
  const [isExporting, setIsExporting] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  const [steps, setSteps] = useState<Step[]>(location.state?.steps || [])
  const [projectName, setProjectName] = useState(location.state?.projectName || 'documentation')
  const [language, setLanguage] = useState<ProjectLanguage>(() =>
    location.state?.language || { code: 'en', name: 'English' }
  )
  const [projectPath, setProjectPath] = useState<string | null>(
    location.state?.projectPath || projectPathFromQuery || null
  )

  // Branding / options
  const [author, setAuthor] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [watermark, setWatermark] = useState('')
  const [logoPath, setLogoPath] = useState('')
  const [includeToc, setIncludeToc] = useState(true)
  const [includeLof, setIncludeLof] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeNarrative, setIncludeNarrative] = useState(false)

  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  // Load defaults from config + project (if only path provided)
  useEffect(() => {
    async function init() {
      try {
        const cfg = await window.electronAPI.getConfig()
        if (cfg.exportFormat) setSelectedFormat(cfg.exportFormat as ExportFormat)
        if (cfg.exportTemplate) setSelectedTemplate(cfg.exportTemplate)
        setLanguage(await resolveConfiguredLanguage(location.state?.language || language))
      } catch { /* ignore */ }

      if (projectPathFromQuery && (!location.state?.steps)) {
        const result = await window.electronAPI.loadProject(projectPathFromQuery)
        if (result.success && result.project) {
          setProjectName(result.project.name || result.project.projectName || 'documentation')
          setFileName(result.project.name || 'documentation')
          setProjectPath(projectPathFromQuery)
          setLanguage(await resolveConfiguredLanguage(result.project.language))
          if (result.project.steps) {
            setSteps(result.project.steps.map((s: any) => ({
              id: s.id || crypto.randomUUID(),
              number: s.number,
              title: s.title,
              caption: s.caption || s.generated_caption || s.title || '',
              description: s.description || '',
              imagePath: s.imagePath,
              captured: !!s.imagePath,
              skipped: s.skipped || false,
              notes: s.notes || '',
              generated_description: s.generated_description || '',
              generated_caption: s.generated_caption || s.caption || '',
              ocr_text: s.ocr_text || '',
              validation: s.validation || null,
              branches: s.branches || [],
            })))
          }
        }
      } else {
        setFileName(location.state?.projectName || 'documentation')
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const absImage = (s: Step) =>
    s.imagePath && projectPath ? `${projectPath}/${s.imagePath}` : null

  const toBackendSteps = () =>
    steps.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      caption: s.caption || '',
      description: s.description,
      generated_description: s.generated_description || '',
      generated_caption: s.generated_caption || s.caption || '',
      notes: s.notes || '',
      ocr_text: s.ocr_text || '',
      image_path: absImage(s),
      skipped: s.skipped,
    }))

  const handlePickLogo = async () => {
    const res = await window.electronAPI.pickFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] },
    ])
    if (res.success && res.path) setLogoPath(res.path)
  }

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true)
    setStatus('Regenerating AI descriptions...')
    try {
      const activeLanguage = await resolveConfiguredLanguage(language)
      setLanguage(activeLanguage)
      const updated = [...steps]
      for (let i = 0; i < updated.length; i++) {
        const s = updated[i]
        const img = absImage(s)
        if (img) {
          try {
            setStatus(`Describing step ${s.number}: ${s.title}...`)
            const { description } = await generateScreenshotDescription(s.title, img, activeLanguage)
            updated[i] = { ...s, generated_description: description }
          } catch (e) {
            console.error('describe failed for step', s.number, e)
          }
        }
      }
      // Captions for all captured steps
      setStatus('Generating captions...')
      try {
        const { captions } = await generateCaptions(
          updated.filter((s) => absImage(s)).map((s) => ({
            id: s.id, title: s.title, caption: s.caption || '', description: s.description,
            generated_description: s.generated_description || '',
          })),
          activeLanguage
        )
        const capMap = new Map(captions.map((c) => [c.id, c.caption]))
        for (let i = 0; i < updated.length; i++) {
          const cap = capMap.get(updated[i].id)
          if (cap) updated[i] = { ...updated[i], generated_caption: cap }
        }
      } catch (e) {
        console.error('captions failed', e)
      }
      setSteps(updated)

      // Persist to manifest
      if (projectPath) {
        await window.electronAPI.saveProjectManifest({
          projectPath,
          manifest: {
            name: projectName,
            projectName,
            updatedAt: new Date().toISOString(),
            language: activeLanguage,
            steps: updated.map((s) => ({
              id: s.id, number: s.number, title: s.title, caption: s.caption || '', description: s.description,
              imagePath: s.imagePath, captured: !!s.imagePath, skipped: s.skipped,
              notes: s.notes || '', generated_description: s.generated_description || '',
              generated_caption: s.generated_caption || s.caption || '',
              ocr_text: s.ocr_text || '', validation: s.validation || null,
              branches: s.branches || [],
            })),
          },
        })
      }
      setStatus('AI text generated.')
      toast({ variant: 'success', title: 'AI text regenerated', description: 'Descriptions and captions now match the project language.' })
    } catch (e) {
      console.error(e)
      setStatus('Failed to generate AI text. Is the backend running?')
      toast({ variant: 'error', title: 'AI generation failed', description: 'Is the backend running and the API key set?' })
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setStatus('Exporting...')
    setLastExportPath(null)
    try {
      const activeLanguage = await resolveConfiguredLanguage(language)
      setLanguage(activeLanguage)
      const outDir = projectPath || (await window.electronAPI.getDefaultProjectLocation())
      const outputPath = `${outDir}/${fileName}`
      const result = await generateReport({
        format: selectedFormat,
        title: projectName,
        outputPath,
        steps: toBackendSteps(),
        template: selectedTemplate,
        includeToc,
        includeLof,
        includeNotes,
        includeNarrative,
        language: activeLanguage,
        branding: {
          title: projectName,
          author,
          subtitle,
          watermark,
          logo_path: logoPath || undefined,
        },
      })
      setLastExportPath(result.output_path)
      setStatus(`Exported to ${result.output_path}`)
      toast({ variant: 'success', title: 'Document exported', description: `${capturedCount} screenshot(s) embedded · ${selectedFormat.toUpperCase()}` })
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Export failed: ${msg}`)
      toast({ variant: 'error', title: 'Export failed', description: msg })
    } finally {
      setIsExporting(false)
    }
  }

  const handleOpenFile = () => {
    if (lastExportPath) window.electronAPI.openPath(lastExportPath)
  }

  const handleShowInFolder = () => {
    if (lastExportPath) window.electronAPI.showItemInFolder(lastExportPath)
  }

  const capturedCount = steps.filter((s) => s.imagePath).length
  const nonSkippedCount = steps.filter((s) => !s.skipped).length
  const missingShots = nonSkippedCount - capturedCount

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
          <h1 className="text-3xl font-bold gradient-text">Generate Document</h1>
          <div className="w-20" />
        </div>

        <WorkflowSteps current="export" projectPath={projectPath} className="mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ---- Left: configuration ---- */}
          <div className="lg:col-span-2 space-y-6">
            {/* Format */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Export Format</CardTitle>
                <CardDescription>Choose the format for your documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {formatOptions.map((option) => {
                    const Icon = option.icon
                    const selected = selectedFormat === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedFormat(option.value)}
                        aria-pressed={selected}
                        className={`relative text-left rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-secondary/40 hover:border-primary/35 hover:bg-primary/5 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/25 dark:hover:bg-white/10'
                        }`}
                      >
                        <span
                          className={`absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full border ${
                            selected ? 'border-primary bg-primary' : 'border-border dark:border-white/25'
                          }`}
                        >
                          {selected && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                        </span>
                        <Icon className={`h-6 w-6 mb-3 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-snug">{option.description}</div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* File name + template */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Output</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fileName">Output file name</Label>
                  <div className="flex items-center gap-2">
                    <Input id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1" />
                    <span className="text-sm text-muted-foreground">.{selectedFormat}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Template</Label>
                  <select
                    id="template"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
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

            {/* Branding */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Branding & Sections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="author">Author</Label>
                    <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtitle">Subtitle</Label>
                    <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Optional subtitle" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="watermark">Watermark (PDF/LaTeX)</Label>
                  <Input id="watermark" value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="e.g. CONFIDENTIAL" />
                </div>
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-2">
                    <Input value={logoPath} onChange={(e) => setLogoPath(e.target.value)} placeholder="No logo selected" className="flex-1" readOnly />
                    <Button type="button" variant="outline" onClick={handlePickLogo} className="gap-2">
                      <ImageIcon className="h-4 w-4" /> Choose
                    </Button>
                    {logoPath && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLogoPath('')}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toc">Table of Contents</Label>
                  <Switch id="toc" checked={includeToc} onCheckedChange={setIncludeToc} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="lof">List of Figures</Label>
                  <Switch id="lof" checked={includeLof} onCheckedChange={setIncludeLof} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notes">Include Notes</Label>
                  <Switch id="notes" checked={includeNotes} onCheckedChange={setIncludeNotes} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="narrative">AI Introduction & Conclusion</Label>
                    <p className="text-xs text-muted-foreground">Generate intro/conclusion prose from your steps.</p>
                  </div>
                  <Switch id="narrative" checked={includeNarrative} onCheckedChange={setIncludeNarrative} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---- Right: sticky summary + actions ---- */}
          <div className="space-y-6 lg:sticky lg:top-8">
            {/* Screenshot summary */}
            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Screenshots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold gradient-text">{capturedCount}</span>
                  <span className="text-sm text-muted-foreground">of {nonSkippedCount} steps captured</span>
                </div>
                <div className={`rounded-lg border px-3 py-2 text-xs ${missingShots > 0 ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-green-500/30 bg-green-500/5 text-green-300'}`}>
                  {missingShots > 0
                    ? `${missingShots} step${missingShots === 1 ? '' : 's'} have no screenshot yet — capture them in Review for a complete report.`
                    : 'All steps captured. PDF & DOCX embed images directly; MD & LaTeX reference them alongside the file.'}
                </div>
              </CardContent>
            </Card>

            {/* AI enrichment */}
            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> AI Enrichment
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate descriptions and figure captions for captured screenshots.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleGenerateAI} disabled={isGeneratingAI || capturedCount === 0} variant="secondary" className="gap-2 w-full">
                  {isGeneratingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGeneratingAI ? 'Generating...' : 'Generate AI text'}
                </Button>
              </CardContent>
            </Card>

            {/* Export action */}
            <Card className="glass">
              <CardContent className="pt-6 space-y-3">
                <Button onClick={handleExport} size="lg" className="gap-2 w-full" disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                  {isExporting ? 'Exporting...' : 'Export Document'}
                </Button>

                {lastExportPath && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleShowInFolder} className="gap-2 flex-1">
                      <FolderOpen className="h-4 w-4" /> Folder
                    </Button>
                    <Button variant="outline" onClick={handleOpenFile} className="gap-2 flex-1">
                      <File className="h-4 w-4" /> Open
                    </Button>
                  </div>
                )}

                {status && (
                  <div className="text-xs text-muted-foreground flex items-start gap-2 pt-1">
                    {(isExporting || isGeneratingAI) && <Loader2 className="h-3.5 w-3.5 animate-spin mt-0.5 flex-shrink-0" />}
                    {lastExportPath && !isExporting && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />}
                    <span className="break-all">{status}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
