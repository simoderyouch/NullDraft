import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft, Upload, Loader2, Camera, Check, Wand2, FolderOpen, File as FileIcon } from 'lucide-react'
import { analyzeDocument, enhanceDocument } from '@/lib/api'

interface Placeholder {
  location: string
  suggested_title: string
  suggested_description: string
  imagePath?: string | null  // absolute path of the captured image
}

export default function EnhanceDocument() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([])
  const [summary, setSummary] = useState('')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [outName, setOutName] = useState('enhanced-document')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [busyIndex, setBusyIndex] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [resultPath, setResultPath] = useState<string | null>(null)

  const isSupported = (f: File) => /\.(docx|tex)$/i.test(f.name)

  const handlePick = () => fileInputRef.current?.click()

  const onFile = async (f: File) => {
    if (!isSupported(f)) {
      setStatus('Only .docx and .tex files are supported.')
      return
    }
    setFile(f)
    setResultPath(null)
    setOutName(f.name.replace(/\.(docx|tex)$/i, '') + '-enhanced')
    setIsAnalyzing(true)
    setStatus('Analyzing document for figure placeholders...')
    try {
      const data = await analyzeDocument(f)
      const ph: Placeholder[] = (data.placeholders || []).map((p: any) => ({
        location: p.location || '',
        suggested_title: p.suggested_title || '',
        suggested_description: p.suggested_description || '',
        imagePath: null,
      }))
      setPlaceholders(ph)
      setSummary(data.summary || `${ph.length} placeholder(s) found.`)
      // Create a holding project for captured images.
      const proj = await window.electronAPI.initProject(f.name.replace(/\.(docx|tex)$/i, ''))
      if (proj.success && proj.projectPath) setProjectPath(proj.projectPath)
      setStatus(ph.length ? '' : 'No placeholders detected. You can still capture and insert figures manually.')
    } catch (e) {
      console.error(e)
      setStatus(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCapture = async (index: number) => {
    if (!projectPath) return
    setBusyIndex(index)
    try {
      await window.electronAPI.hideWindow()
      await new Promise((r) => setTimeout(r, 600))
      const result = await window.electronAPI.captureScreenshot({
        projectPath,
        stepNumber: index + 1,
        stepTitle: placeholders[index].suggested_title || `figure-${index + 1}`,
      })
      await window.electronAPI.showWindow()
      if (result.success && result.filename) {
        const abs = `${projectPath}/${result.filename}`
        setPlaceholders((prev) => prev.map((p, i) => (i === index ? { ...p, imagePath: abs } : p)))
      }
    } catch (e) {
      console.error(e)
      await window.electronAPI.showWindow()
    } finally {
      setBusyIndex(null)
    }
  }

  const handleExport = async () => {
    if (!file || !projectPath) return
    const mappings = placeholders
      .filter((p) => p.imagePath)
      .map((p) => ({ placeholder: p.location, image_path: p.imagePath as string, caption: p.suggested_title }))
    if (mappings.length === 0) {
      setStatus('Capture at least one figure before exporting.')
      return
    }
    setIsExporting(true)
    setStatus('Inserting figures into your document...')
    try {
      const outputPath = `${projectPath}/${outName}`
      const res = await enhanceDocument(file, mappings, outputPath)
      setResultPath(res.output_path)
      setStatus(`Enhanced document saved to ${res.output_path}`)
    } catch (e) {
      console.error(e)
      setStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsExporting(false)
    }
  }

  const capturedCount = placeholders.filter((p) => p.imagePath).length

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Home
          </Button>
          <h1 className="text-3xl font-bold">Enhance Existing Document</h1>
          <div className="w-20" />
        </div>

        {!file && (
          <Card
            className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-all cursor-pointer"
            onClick={handlePick}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".docx,.tex"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
            />
            <CardContent className="p-16 text-center">
              <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-2xl font-semibold mb-2">Drop a .docx or .tex file</h3>
              <p className="text-muted-foreground">
                NullDraft finds figure placeholders and lets you fill them with captures while preserving numbering.
              </p>
            </CardContent>
          </Card>
        )}

        {file && (
          <>
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileIcon className="h-5 w-5" /> {file.name}
                </CardTitle>
                <CardDescription>
                  {isAnalyzing ? 'Analyzing...' : summary}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="outName">Output file name</Label>
                  <Input id="outName" value={outName} onChange={(e) => setOutName(e.target.value)} className="mt-1" />
                </div>
                <Button variant="ghost" onClick={() => { setFile(null); setPlaceholders([]); setResultPath(null); setStatus('') }} className="mt-6">
                  Choose another
                </Button>
              </CardContent>
            </Card>

            {isAnalyzing && (
              <div className="text-center py-12">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              </div>
            )}

            {placeholders.length > 0 && (
              <ScrollArea className="h-[calc(100vh-440px)] pr-4 -mr-4">
                <div className="space-y-3 pb-6">
                  {placeholders.map((p, i) => (
                    <Card key={i} className={p.imagePath ? 'border-green-500/30 bg-green-500/5' : 'border-muted/50'}>
                      <CardContent className="p-4 flex gap-4 items-start">
                        <div className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full font-bold ${p.imagePath ? 'bg-green-500/20 text-green-500' : 'bg-primary/20 text-primary'}`}>
                          {p.imagePath ? <Check className="h-4 w-4" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold">{p.suggested_title || `Figure ${i + 1}`}</h3>
                          {p.suggested_description && <p className="text-sm text-muted-foreground">{p.suggested_description}</p>}
                          <p className="text-xs text-muted-foreground/70 mt-1 italic line-clamp-1">…{p.location}…</p>
                        </div>
                        {p.imagePath && (
                          <img src={`file://${p.imagePath}`} alt="capture" className="w-24 h-16 object-cover rounded border border-green-500/30" />
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleCapture(i)} disabled={busyIndex === i} className="gap-1 mt-1">
                          {busyIndex === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                          {p.imagePath ? 'Retake' : 'Capture'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {status && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                {(isExporting || isAnalyzing) && <Loader2 className="h-4 w-4 animate-spin" />}
                {status}
              </div>
            )}

            <div className="flex justify-end gap-3">
              {resultPath && (
                <>
                  <Button variant="outline" onClick={() => window.electronAPI.showItemInFolder(resultPath)} className="gap-2">
                    <FolderOpen className="h-4 w-4" /> Show in folder
                  </Button>
                  <Button variant="outline" onClick={() => window.electronAPI.openPath(resultPath)} className="gap-2">
                    <FileIcon className="h-4 w-4" /> Open
                  </Button>
                </>
              )}
              <Button onClick={handleExport} size="lg" disabled={isExporting || capturedCount === 0} className="gap-2">
                {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                Insert {capturedCount} figure{capturedCount === 1 ? '' : 's'} & Export
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
