import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, Undo2, Redo2, ArrowUpRight, Highlighter, Type, Droplets, Loader2, CircleDot, Trash2, ZoomIn, ZoomOut, Hand, Maximize2, Copy, Eye, EyeOff, ChevronUp, ChevronDown, Move } from 'lucide-react'
import { Step } from '@/lib/projectTypes'

type Tool = 'arrow' | 'highlight' | 'text' | 'blur' | 'marker'

interface Shape {
  tool: Tool
  x: number
  y: number
  w: number
  h: number
  color: string
  width: number
  text?: string
  visible?: boolean
}

function canResizeShape(shape: Shape) {
  return shape.tool === 'arrow' || shape.tool === 'highlight' || shape.tool === 'blur'
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
  const [blurStrength, setBlurStrength] = useState(28)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [redoShapes, setRedoShapes] = useState<Shape[]>([])
  const [drawing, setDrawing] = useState<Shape | null>(null)
  const [textValue, setTextValue] = useState('Label')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isMovingLayer, setIsMovingLayer] = useState(false)
  const [isResizingLayer, setIsResizingLayer] = useState(false)
  const [interactionMode, setInteractionMode] = useState<'draw' | 'pan' | 'move' | 'resize'>('draw')
  const [selectedShapeIndex, setSelectedShapeIndex] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const layerMoveStartRef = useRef({ x: 0, y: 0, shapeX: 0, shapeY: 0 })
  const layerResizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

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

  const redraw = useCallback((showSelection = true) => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    const allShapes = drawing ? [...shapes, drawing] : shapes
    for (const s of allShapes) {
      if (s.visible === false) continue
      if (s.tool === 'blur') {
        const x = Math.min(s.x, s.x + s.w)
        const y = Math.min(s.y, s.y + s.h)
        const w = Math.abs(s.w)
        const h = Math.abs(s.h)
        if (w < 2 || h < 2) continue
        drawBlurredRegion(ctx, img, x, y, w, h, s.width)
        continue
      }
      ctx.save()
      ctx.strokeStyle = s.color
      ctx.fillStyle = s.color
      ctx.lineWidth = s.width
      ctx.lineCap = 'round'
      if (s.tool === 'highlight') {
        ctx.globalAlpha = 0.22
        ctx.fillRect(s.x, s.y, s.w, s.h)
        ctx.globalAlpha = 1
        ctx.strokeRect(s.x, s.y, s.w, s.h)
      } else if (s.tool === 'arrow') {
        drawArrow(ctx, s.x, s.y, s.x + s.w, s.y + s.h, s.width)
      } else if (s.tool === 'text') {
        ctx.font = `${Math.max(16, s.width * 6)}px sans-serif`
        ctx.fillText(s.text || '', s.x, s.y)
      } else if (s.tool === 'marker') {
        const radius = Math.max(14, s.width * 4)
        ctx.beginPath()
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.max(13, radius)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.text || '', s.x, s.y + 1)
      }
      ctx.restore()
    }

    const selected = selectedShapeIndex === null ? null : shapes[selectedShapeIndex]
    if (showSelection && selected && selected.visible !== false) {
      drawSelectionOutline(ctx, selected)
    }
  }, [shapes, drawing, selectedShapeIndex])

  useEffect(() => { redraw() }, [redraw, loaded])

  const toCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const addShape = (shape: Shape) => {
    setShapes((prev) => [...prev, shape])
    setRedoShapes([])
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (interactionMode === 'pan') {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      setIsPanning(true)
      return
    }

    if (interactionMode === 'move' && selectedShape) {
      const { x, y } = toCanvasCoords(e)
      layerMoveStartRef.current = { x, y, shapeX: selectedShape.x, shapeY: selectedShape.y }
      setIsMovingLayer(true)
      return
    }

    if (interactionMode === 'resize' && selectedShape && canResizeShape(selectedShape)) {
      const { x, y } = toCanvasCoords(e)
      layerResizeStartRef.current = { x, y, width: selectedShape.w, height: selectedShape.h }
      setIsResizingLayer(true)
      return
    }

    const { x, y } = toCanvasCoords(e)
    if (tool === 'text') {
      addShape({ tool, x, y, w: 0, h: 0, color, width: strokeWidth, text: textValue })
      return
    }
    if (tool === 'marker') {
      const nextMarker = shapes.filter((shape) => shape.tool === 'marker').length + 1
      addShape({ tool, x, y, w: 0, h: 0, color, width: strokeWidth, text: String(nextMarker) })
      return
    }
    setDrawing({ tool, x, y, w: 0, h: 0, color, width: tool === 'blur' ? blurStrength : strokeWidth })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: panStartRef.current.panX + e.clientX - panStartRef.current.x,
        y: panStartRef.current.panY + e.clientY - panStartRef.current.y,
      })
      return
    }
    if (isMovingLayer && selectedShapeIndex !== null) {
      const { x, y } = toCanvasCoords(e)
      setShapes((previous) => previous.map((shape, index) => (
        index === selectedShapeIndex
          ? {
              ...shape,
              x: layerMoveStartRef.current.shapeX + x - layerMoveStartRef.current.x,
              y: layerMoveStartRef.current.shapeY + y - layerMoveStartRef.current.y,
            }
          : shape
      )))
      return
    }
    if (isResizingLayer && selectedShapeIndex !== null) {
      const { x, y } = toCanvasCoords(e)
      setShapes((previous) => previous.map((shape, index) => (
        index === selectedShapeIndex
          ? {
              ...shape,
              w: layerResizeStartRef.current.width + x - layerResizeStartRef.current.x,
              h: layerResizeStartRef.current.height + y - layerResizeStartRef.current.y,
            }
          : shape
      )))
      return
    }
    if (!drawing) return
    const { x, y } = toCanvasCoords(e)
    setDrawing({ ...drawing, w: x - drawing.x, h: y - drawing.y })
  }

  const onMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
      return
    }
    if (isMovingLayer) {
      setIsMovingLayer(false)
      setRedoShapes([])
      return
    }
    if (isResizingLayer) {
      setIsResizingLayer(false)
      setRedoShapes([])
      return
    }
    if (drawing) {
      addShape(drawing)
      setDrawing(null)
    }
  }

  const handleUndo = () => {
    setSelectedShapeIndex(null)
    setShapes((prev) => {
      const removed = prev.at(-1)
      if (removed) setRedoShapes((redo) => [removed, ...redo])
      return prev.slice(0, -1)
    })
  }

  const handleRedo = () => {
    setSelectedShapeIndex(null)
    setRedoShapes((prev) => {
      const restored = prev[0]
      if (restored) setShapes((current) => [...current, restored])
      return prev.slice(1)
    })
  }

  const handleClear = () => {
    if (!shapes.length) return
    setRedoShapes(shapes)
    setShapes([])
    setSelectedShapeIndex(null)
    setStatus('Annotations cleared. Use Redo to restore them.')
  }

  const handleBlurStrengthChange = (strength: number) => {
    setBlurStrength(strength)
    setShapes((previous) => previous.map((shape, index) => (
      selectedShapeIndex !== null
        ? index === selectedShapeIndex && shape.tool === 'blur' ? { ...shape, width: strength } : shape
        : shape.tool === 'blur' ? { ...shape, width: strength } : shape
    )))
    setDrawing((current) => (
      current?.tool === 'blur' ? { ...current, width: strength } : current
    ))
  }

  const selectedShape = selectedShapeIndex === null ? null : shapes[selectedShapeIndex] || null

  const updateSelectedShape = (updates: Partial<Shape>) => {
    if (selectedShapeIndex === null) return
    setShapes((previous) => previous.map((shape, index) => (
      index === selectedShapeIndex ? { ...shape, ...updates } : shape
    )))
    setRedoShapes([])
  }

  const selectTool = (nextTool: Tool) => {
    setTool(nextTool)
    setSelectedShapeIndex(null)
    setInteractionMode('draw')
  }

  const selectLayer = (index: number) => {
    const layer = shapes[index]
    if (!layer) return
    setSelectedShapeIndex(index)
    setTool(layer.tool)
    setInteractionMode('draw')
  }

  const setAnnotationColor = (nextColor: string) => {
    setColor(nextColor)
    if (selectedShape?.tool !== 'blur') updateSelectedShape({ color: nextColor })
  }

  const setAnnotationStrokeWidth = (nextWidth: number) => {
    setStrokeWidth(nextWidth)
    if (selectedShape && selectedShape.tool !== 'blur') updateSelectedShape({ width: nextWidth })
  }

  const toggleLayerVisibility = (index: number) => {
    setShapes((previous) => previous.map((shape, layerIndex) => (
      layerIndex === index ? { ...shape, visible: shape.visible === false } : shape
    )))
  }

  const deleteSelectedShape = () => {
    if (selectedShapeIndex === null) return
    setShapes((previous) => previous.filter((_, index) => index !== selectedShapeIndex))
    setRedoShapes([])
    setSelectedShapeIndex(null)
  }

  const duplicateSelectedShape = () => {
    if (!selectedShape) return
    const copy = { ...selectedShape, x: selectedShape.x + 24, y: selectedShape.y + 24, visible: true }
    setShapes((previous) => [...previous, copy])
    setRedoShapes([])
    setSelectedShapeIndex(shapes.length)
  }

  const moveSelectedLayer = (direction: -1 | 1) => {
    if (selectedShapeIndex === null) return
    const nextIndex = Math.max(0, Math.min(shapes.length - 1, selectedShapeIndex + direction))
    if (nextIndex === selectedShapeIndex) return
    setShapes((previous) => {
      const reordered = [...previous]
      const [layer] = reordered.splice(selectedShapeIndex, 1)
      reordered.splice(nextIndex, 0, layer)
      return reordered
    })
    setSelectedShapeIndex(nextIndex)
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setInteractionMode('draw')
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas || !absImage) return
    setBusy(true)
    setStatus('Saving...')
    try {
      redraw(false)
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
      redraw()
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
    { id: 'highlight', label: 'Highlight', icon: Highlighter },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'marker', label: 'Marker', icon: CircleDot },
    { id: 'blur', label: 'Blur', icon: Droplets },
  ]
  const activeTool = tools.find((item) => item.id === tool) || tools[0]
  const ActiveToolIcon = activeTool.icon
  const colorPresets = ['#ff3b30', '#0a84ff', '#ffd60a', '#34c759', '#bf5af2', '#ffffff']
  const panelColor = selectedShape?.tool !== 'blur' ? selectedShape?.color || color : color
  const panelStrokeWidth = selectedShape && selectedShape.tool !== 'blur' ? selectedShape.width : strokeWidth
  const panelBlurStrength = selectedShape?.tool === 'blur' ? selectedShape.width : blurStrength
  const panelText = selectedShape?.tool === 'text' ? selectedShape.text || '' : textValue
  const strokeProgress = ((panelStrokeWidth - 1) / 11) * 100
  const blurProgress = ((panelBlurStrength - 12) / 60) * 100
  const layers = shapes.map((shape, index) => ({ shape, index })).reverse()
  const selectedCanResize = selectedShape ? canResizeShape(selectedShape) : false
  const canvasCursor = interactionMode === 'pan'
    ? isPanning ? 'grabbing' : 'grab'
    : interactionMode === 'move'
      ? isMovingLayer ? 'grabbing' : 'move'
      : interactionMode === 'resize'
        ? 'nwse-resize'
        : tool === 'text' ? 'text' : 'crosshair'

  return (
    <div className="min-h-screen p-4 lg:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col gap-4 lg:min-h-[calc(100vh-2.5rem)]">
        <header className="relative z-50 grid grid-cols-[1fr_auto_1fr] items-center gap-3 pr-24" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div>
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-white/90 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-white">Annotate</h1>
          <div className="flex items-center justify-end gap-1.5">
            <Button size="icon" variant="ghost" onClick={handleUndo} disabled={!shapes.length} className="h-9 w-9 text-white/80 hover:bg-white/10" title="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleRedo} disabled={!redoShapes.length} className="h-9 w-9 text-white/80 hover:bg-white/10" title="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={busy} className="ml-2 gap-2 px-5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[88px_minmax(0,1fr)_270px] gap-4 lg:grid-cols-[104px_minmax(0,1fr)_300px]">
          <aside className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-card/55 p-2 shadow-lg shadow-black/20 backdrop-blur-xl">
            <span className="w-full pb-2 pt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tools</span>
            <div className="space-y-1.5">
              {tools.map((item) => {
                const Icon = item.icon
                const isActive = tool === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTool(item.id)}
                    className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 text-center text-xs font-medium leading-tight transition-all ${isActive
                      ? 'border border-primary/60 bg-primary/15 text-white shadow-inner shadow-primary/20'
                      : 'border border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.06] hover:text-white'
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="max-w-full truncate text-center">{item.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-auto px-2 pb-2 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              Choose a tool, then draw on the canvas.
            </p>
          </aside>

          <main className="relative min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-5 shadow-inner shadow-black/30">
            <div className="flex min-h-full min-w-full items-center justify-center">
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                className="block w-full rounded-sm shadow-2xl shadow-black/45"
                style={{
                  cursor: canvasCursor,
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              />
            </div>

            <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
              <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/15 bg-[hsl(222_44%_12%_/_0.92)] p-1.5 shadow-xl shadow-black/35 backdrop-blur-xl" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <Button
                  size="icon"
                  variant={interactionMode === 'pan' ? 'default' : 'ghost'}
                  className={`h-8 w-8 ${interactionMode === 'pan' ? '' : 'text-white/80 hover:bg-white/10'}`}
                  onClick={() => setInteractionMode((mode) => mode === 'pan' ? 'draw' : 'pan')}
                  title={interactionMode === 'pan' ? 'Stop moving canvas' : 'Move canvas'}
                >
                  <Hand className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/80 hover:bg-white/10" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} disabled={zoom <= 0.5} title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-12 text-center text-xs font-medium text-white/90">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/80 hover:bg-white/10" onClick={() => setZoom((value) => Math.min(2, value + 0.25))} disabled={zoom >= 2} title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/80 hover:bg-white/10" onClick={resetView} title="Reset view">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </main>

          <aside className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-card/55 p-4 shadow-lg shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <ActiveToolIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white">{activeTool.label}</h2>
                <p className="text-xs text-muted-foreground">Tool settings</p>
              </div>
            </div>

            <div className="space-y-5 py-5">
              {tool !== 'blur' && (
                <div className="space-y-2.5">
                  <Label className="text-xs font-medium text-white/90">Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        aria-label={`Use ${preset} color`}
                        onClick={() => setAnnotationColor(preset)}
                        className={`h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110 ${panelColor.toLowerCase() === preset ? 'border-white ring-2 ring-primary/70 ring-offset-2 ring-offset-card' : 'border-white/20'}`}
                        style={{ backgroundColor: preset }}
                      />
                    ))}
                    <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/30 text-xs text-white/70 hover:border-white/60">
                      +
                      <input type="color" value={panelColor} onChange={(event) => setAnnotationColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom annotation color" />
                    </label>
                  </div>
                </div>
              )}

              {tool !== 'blur' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="annotationWidth" className="text-xs font-medium text-white/90">Stroke width</Label>
                    <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/80">{panelStrokeWidth}px</span>
                  </div>
                  <input
                    id="annotationWidth"
                    type="range"
                    min={1}
                    max={12}
                    value={panelStrokeWidth}
                    onChange={(event) => setAnnotationStrokeWidth(Number(event.target.value))}
                    className="annotate-slider"
                    style={{ '--slider-progress': `${strokeProgress}%` } as React.CSSProperties}
                  />
                </div>
              )}

              {tool === 'blur' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="blurStrength" className="text-xs font-medium text-white/90">Blur strength</Label>
                    <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/80">{panelBlurStrength}</span>
                  </div>
                  <input
                    id="blurStrength"
                    type="range"
                    min={12}
                    max={72}
                    value={panelBlurStrength}
                    onChange={(event) => handleBlurStrengthChange(Number(event.target.value))}
                    className="annotate-slider"
                    style={{ '--slider-progress': `${blurProgress}%` } as React.CSSProperties}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">Draw slightly wider than the text for a natural soft-edge redaction.</p>
                </div>
              )}

              {tool === 'text' && (
                <div className="space-y-2.5">
                  <Label htmlFor="annotationText" className="text-xs font-medium text-white/90">Text</Label>
                  <Input
                    id="annotationText"
                    value={panelText}
                    onChange={(event) => {
                      setTextValue(event.target.value)
                      if (selectedShape?.tool === 'text') updateSelectedShape({ text: event.target.value })
                    }}
                    className="border-white/15 bg-black/20"
                  />
                </div>
              )}

              {selectedShape && (
                <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
                  <div>
                    <p className="text-xs font-medium text-white">Layer properties</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Edit exact values or use Move / Resize below.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="layerX" className="text-[11px] text-muted-foreground">X</Label>
                      <Input id="layerX" type="number" value={Math.round(selectedShape.x)} onChange={(event) => updateSelectedShape({ x: Number(event.target.value) || 0 })} className="h-8 border-white/10 bg-black/20 px-2 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="layerY" className="text-[11px] text-muted-foreground">Y</Label>
                      <Input id="layerY" type="number" value={Math.round(selectedShape.y)} onChange={(event) => updateSelectedShape({ y: Number(event.target.value) || 0 })} className="h-8 border-white/10 bg-black/20 px-2 text-xs" />
                    </div>
                    {selectedCanResize && (
                      <>
                        <div className="space-y-1">
                          <Label htmlFor="layerWidth" className="text-[11px] text-muted-foreground">Width</Label>
                          <Input id="layerWidth" type="number" value={Math.round(selectedShape.w)} onChange={(event) => updateSelectedShape({ w: Number(event.target.value) || 0 })} className="h-8 border-white/10 bg-black/20 px-2 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="layerHeight" className="text-[11px] text-muted-foreground">Height</Label>
                          <Input id="layerHeight" type="number" value={Math.round(selectedShape.h)} onChange={(event) => updateSelectedShape({ h: Number(event.target.value) || 0 })} className="h-8 border-white/10 bg-black/20 px-2 text-xs" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/90">Layers</span>
                <span className="text-xs text-muted-foreground">{shapes.length}</span>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {shapes.length ? layers.map(({ shape, index }) => (
                  <div key={`${shape.tool}-${shape.x}-${shape.y}-${index}`} className={`flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-xs transition-colors ${selectedShapeIndex === index ? 'border-primary/60 bg-primary/15 text-white' : 'border-white/10 bg-black/15 text-muted-foreground hover:border-white/20 hover:bg-white/[0.06]'}`}>
                    <button type="button" onClick={() => selectLayer(index)} className="flex min-w-0 flex-1 items-center gap-2 px-1 text-left">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: shape.tool === 'blur' ? '#60a5fa' : shape.color }} />
                      <span className="truncate capitalize">{shape.tool}</span>
                    </button>
                    <button type="button" onClick={() => toggleLayerVisibility(index)} className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-white" title={shape.visible === false ? 'Show layer' : 'Hide layer'}>
                      {shape.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )) : (
                  <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-xs leading-relaxed text-muted-foreground">Your annotations will appear here.</p>
                )}
              </div>
              {selectedShape && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={interactionMode === 'move' ? 'default' : 'outline'}
                    onClick={() => setInteractionMode((mode) => mode === 'move' ? 'draw' : 'move')}
                    className="gap-1 border-white/15 text-white/85 hover:bg-white/10"
                  >
                    <Move className="h-3.5 w-3.5" /> {interactionMode === 'move' ? 'Moving' : 'Move'}
                  </Button>
                  {selectedCanResize ? (
                    <Button
                      size="sm"
                      variant={interactionMode === 'resize' ? 'default' : 'outline'}
                      onClick={() => setInteractionMode((mode) => mode === 'resize' ? 'draw' : 'resize')}
                      className="gap-1 border-white/15 text-white/85 hover:bg-white/10"
                    >
                      <Maximize2 className="h-3.5 w-3.5" /> {interactionMode === 'resize' ? 'Resizing' : 'Resize'}
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button size="sm" variant="outline" onClick={duplicateSelectedShape} className="gap-1 border-white/15 text-white/85 hover:bg-white/10">
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </Button>
                  <Button size="sm" variant="outline" onClick={deleteSelectedShape} className="gap-1 border-white/15 text-white/85 hover:bg-white/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => moveSelectedLayer(1)} disabled={selectedShapeIndex === shapes.length - 1} className="gap-1 border-white/15 text-white/85 hover:bg-white/10">
                    <ChevronUp className="h-3.5 w-3.5" /> Forward
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => moveSelectedLayer(-1)} disabled={selectedShapeIndex === 0} className="gap-1 border-white/15 text-white/85 hover:bg-white/10">
                    <ChevronDown className="h-3.5 w-3.5" /> Backward
                  </Button>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={handleClear} disabled={!shapes.length} className="w-full gap-2 border-white/15 text-white/85 hover:bg-white/10">
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            </div>
          </aside>
        </div>

        {status && <p className="text-center text-sm text-muted-foreground">{status}</p>}
      </div>
    </div>
  )
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, shape: Shape) {
  let x = shape.x
  let y = shape.y
  let width = shape.w
  let height = shape.h
  let padding = Math.max(10, shape.width * 2)

  if (shape.tool === 'text') {
    const fontSize = Math.max(16, shape.width * 6)
    ctx.save()
    ctx.font = `${fontSize}px sans-serif`
    width = ctx.measureText(shape.text || '').width
    height = fontSize * 1.25
    y -= fontSize
    ctx.restore()
  } else if (shape.tool === 'marker') {
    const radius = Math.max(14, shape.width * 4)
    x -= radius
    y -= radius
    width = radius * 2
    height = radius * 2
  } else if (shape.tool === 'arrow') {
    const endX = shape.x + shape.w
    const endY = shape.y + shape.h
    x = Math.min(shape.x, endX)
    y = Math.min(shape.y, endY)
    width = Math.abs(shape.w)
    height = Math.abs(shape.h)
    padding = Math.max(16, shape.width * 4)
  } else {
    x = Math.min(shape.x, shape.x + shape.w)
    y = Math.min(shape.y, shape.y + shape.h)
    width = Math.abs(shape.w)
    height = Math.abs(shape.h)
  }

  ctx.save()
  ctx.setLineDash([8, 6])
  ctx.strokeStyle = '#0a84ff'
  ctx.lineWidth = 2
  ctx.strokeRect(x - padding, y - padding, Math.max(1, width) + padding * 2, Math.max(1, height) + padding * 2)
  ctx.restore()
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

function drawBlurredRegion(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  strength: number,
) {
  // Blur a larger source area, then copy only the requested region back. This
  // prevents unblurred edges from bleeding into the selection.
  const radius = Math.max(12, Math.min(72, strength || 28))
  const padding = radius * 2
  const sourceX = Math.max(0, Math.floor(x - padding))
  const sourceY = Math.max(0, Math.floor(y - padding))
  const sourceRight = Math.min(image.naturalWidth, Math.ceil(x + width + padding))
  const sourceBottom = Math.min(image.naturalHeight, Math.ceil(y + height + padding))
  const sourceWidth = Math.max(1, sourceRight - sourceX)
  const sourceHeight = Math.max(1, sourceBottom - sourceY)

  const buffer = document.createElement('canvas')
  buffer.width = sourceWidth
  buffer.height = sourceHeight
  const bufferContext = buffer.getContext('2d')
  if (!bufferContext) return

  bufferContext.filter = `blur(${radius}px)`
  bufferContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight)

  const region = document.createElement('canvas')
  region.width = Math.max(1, Math.ceil(width))
  region.height = Math.max(1, Math.ceil(height))
  const regionContext = region.getContext('2d')
  if (!regionContext) return
  regionContext.drawImage(buffer, x - sourceX, y - sourceY, width, height, 0, 0, region.width, region.height)

  // Fade the blur into the original image, avoiding the hard rectangular edge
  // that makes a selection look like an opaque box.
  const feather = Math.min(32, Math.max(2, Math.min(region.width, region.height) * 0.18))
  const horizontal = Math.min(0.45, feather / region.width)
  const vertical = Math.min(0.45, feather / region.height)
  const mask = document.createElement('canvas')
  mask.width = region.width
  mask.height = region.height
  const maskContext = mask.getContext('2d')
  if (!maskContext) return

  const horizontalGradient = maskContext.createLinearGradient(0, 0, region.width, 0)
  horizontalGradient.addColorStop(0, 'rgba(0,0,0,0)')
  horizontalGradient.addColorStop(horizontal, 'rgba(0,0,0,1)')
  horizontalGradient.addColorStop(1 - horizontal, 'rgba(0,0,0,1)')
  horizontalGradient.addColorStop(1, 'rgba(0,0,0,0)')
  maskContext.fillStyle = horizontalGradient
  maskContext.fillRect(0, 0, region.width, region.height)

  const verticalGradient = maskContext.createLinearGradient(0, 0, 0, region.height)
  verticalGradient.addColorStop(0, 'rgba(0,0,0,0)')
  verticalGradient.addColorStop(vertical, 'rgba(0,0,0,1)')
  verticalGradient.addColorStop(1 - vertical, 'rgba(0,0,0,1)')
  verticalGradient.addColorStop(1, 'rgba(0,0,0,0)')
  maskContext.globalCompositeOperation = 'destination-in'
  maskContext.fillStyle = verticalGradient
  maskContext.fillRect(0, 0, region.width, region.height)

  regionContext.globalCompositeOperation = 'destination-in'
  regionContext.drawImage(mask, 0, 0)
  ctx.drawImage(region, x, y, width, height)
}
