import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, Undo2, ArrowUpRight, Square, Type, Droplets, ShieldAlert, Loader2 } from 'lucide-react'
import { Step } from '@/lib/projectTypes'
import { detectSensitive } from '@/lib/api'

type Tool = 'arrow' | 'rect' | 'text' | 'blur'

interface Shape {
  tool: Tool
  x: number
  y: number
  w: number
  h: number
  color: string
  width: number
  text?: string
}

export default function Annotate() {
  const navigate = useNavigate()
  const location = useLocation()
  const step: Step | undefined = location.state?.step
  const projectPath: string | undefined = location.state?.projectPath

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState('#ff3b30')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [drawing, setDrawing] = useState<Shape | null>(null)
  const [textValue, setTextValue] = useState('Label')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const absImage = step?.imagePath && projectPath ? `${projectPath}/${step.imagePath}` : null

  // Load the image
  useEffect(() => {
    if (!absImage) return
    const img = new window.Image()
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
      }
      setLoaded(true)
    }
    img.src = `file://${absImage}?t=${Date.now()}`
  }, [absImage])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    const allShapes = drawing ? [...shapes, drawing] : shapes
    for (const s of allShapes) {
      if (s.tool === 'blur') {
        const x = Math.min(s.x, s.x + s.w)
        const y = Math.min(s.y, s.y + s.h)
        const w = Math.abs(s.w)
        const h = Math.abs(s.h)
        if (w < 2 || h < 2) continue
        ctx.save()
        // @ts-ignore - filter is supported in Chromium canvas
        ctx.filter = 'blur(12px)'
        ctx.drawImage(img, x, y, w, h, x, y, w, h)
        ctx.restore()
        continue
      }
      ctx.save()
      ctx.strokeStyle = s.color
      ctx.fillStyle = s.color
      ctx.lineWidth = s.width
      ctx.lineCap = 'round'
      if (s.tool === 'rect') {
        ctx.strokeRect(s.x, s.y, s.w, s.h)
      } else if (s.tool === 'arrow') {
        drawArrow(ctx, s.x, s.y, s.x + s.w, s.y + s.h, s.width)
      } else if (s.tool === 'text') {
        ctx.font = `${Math.max(16, s.width * 6)}px sans-serif`
        ctx.fillText(s.text || '', s.x, s.y)
      }
      ctx.restore()
    }
  }, [shapes, drawing])

  useEffect(() => { redraw() }, [redraw, loaded])

  const toCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = toCanvasCoords(e)
    if (tool === 'text') {
      setShapes((prev) => [...prev, { tool, x, y, w: 0, h: 0, color, width: strokeWidth, text: textValue }])
      return
    }
    setDrawing({ tool, x, y, w: 0, h: 0, color, width: strokeWidth })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return
    const { x, y } = toCanvasCoords(e)
    setDrawing({ ...drawing, w: x - drawing.x, h: y - drawing.y })
  }

  const onMouseUp = () => {
    if (drawing) {
      setShapes((prev) => [...prev, drawing])
      setDrawing(null)
    }
  }

  const handleUndo = () => setShapes((prev) => prev.slice(0, -1))

  const handleAIDetect = async () => {
    if (!absImage) return
    setBusy(true)
    setStatus('Detecting sensitive data...')
    try {
      const { regions } = await detectSensitive(absImage)
      const canvas = canvasRef.current!
      const newShapes: Shape[] = regions.map((r) => ({
        tool: 'blur' as Tool,
        x: r.x * canvas.width,
        y: r.y * canvas.height,
        w: r.width * canvas.width,
        h: r.height * canvas.height,
        color: '#000',
        width: 0,
      }))
      setShapes((prev) => [...prev, ...newShapes])
      setStatus(`Added ${newShapes.length} blur region(s).`)
    } catch (e) {
      console.error(e)
      setStatus('Detection failed. Is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas || !absImage) return
    setBusy(true)
    setStatus('Saving...')
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const res = await window.electronAPI.saveBase64Image({ filePath: absImage, base64: dataUrl })
      if (res.success) {
        setStatus('Saved.')
        navigate(-1)
      } else {
        setStatus(`Save failed: ${res.error}`)
      }
    } catch (e) {
      setStatus(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  if (!step || !absImage) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No screenshot to annotate.</p>
          <Button onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    )
  }

  const tools: Array<{ id: Tool; label: string; icon: any }> = [
    { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
    { id: 'rect', label: 'Highlight', icon: Square },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'blur', label: 'Blur', icon: Droplets },
  ]

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Annotate: {step.title}</h1>
          <Button onClick={handleSave} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-card/50 border border-muted/50">
          {tools.map((t) => {
            const Icon = t.icon
            return (
              <Button key={t.id} size="sm" variant={tool === t.id ? 'default' : 'outline'} onClick={() => setTool(t.id)} className="gap-1">
                <Icon className="h-4 w-4" /> {t.label}
              </Button>
            )
          })}
          <div className="flex items-center gap-2 ml-2">
            <Label className="text-xs">Color</Label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer bg-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Width</Label>
            <input type="range" min={1} max={12} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
          </div>
          {tool === 'text' && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">Text</Label>
              <Input value={textValue} onChange={(e) => setTextValue(e.target.value)} className="h-8 w-40" />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={handleUndo} className="gap-1 ml-auto">
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
          <Button size="sm" variant="outline" onClick={handleAIDetect} disabled={busy} className="gap-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} AI Blur Secrets
          </Button>
        </div>

        {status && <p className="text-sm text-muted-foreground">{status}</p>}

        <div className="border border-muted/50 rounded-lg overflow-auto bg-black/20 flex items-center justify-center" style={{ maxHeight: '70vh' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className="max-w-full"
            style={{ cursor: tool === 'text' ? 'text' : 'crosshair' }}
          />
        </div>
      </div>
    </div>
  )
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number) {
  const headlen = Math.max(12, width * 3)
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}
