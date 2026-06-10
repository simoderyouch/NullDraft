// Backend API client. The base URL is discovered from the main process so it
// stays in sync with the spawned Python backend; falls back to the default.

let cachedBaseUrl: string | null = null

async function getBaseUrl(): Promise<string> {
    if (cachedBaseUrl) return cachedBaseUrl
    try {
        if (typeof window !== 'undefined' && window.electronAPI?.getBackendUrl) {
            cachedBaseUrl = await window.electronAPI.getBackendUrl()
            return cachedBaseUrl
        }
    } catch {
        // ignore
    }
    cachedBaseUrl = 'http://127.0.0.1:8000'
    return cachedBaseUrl
}

async function api(path: string): Promise<string> {
    const base = await getBaseUrl()
    return `${base}${path}`
}

// Privacy: when "local only" is enabled in settings, AI calls that upload a
// screenshot to the cloud provider must be blocked.
export class LocalOnlyError extends Error {
    constructor() {
        super('Local-only mode is on — disable it in Settings to use cloud AI on screenshots.')
        this.name = 'LocalOnlyError'
    }
}

export async function isLocalOnly(): Promise<boolean> {
    try {
        const cfg = await window.electronAPI.getConfig()
        return !!cfg?.localOnly
    } catch {
        return false
    }
}

async function assertCloudAllowed() {
    if (await isLocalOnly()) throw new LocalOnlyError()
}

// Read an on-disk image (absolute path) into a Blob via the main process.
async function fileToBlob(absPath: string): Promise<Blob> {
    const res = await window.electronAPI.readFileBase64(absPath)
    if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to read image file')
    }
    const binary = atob(res.data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const ext = absPath.toLowerCase().endsWith('.jpg') || absPath.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg' : 'image/png'
    return new Blob([bytes], { type: ext })
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getHealth() {
    const res = await fetch(await api('/health'))
    if (!res.ok) throw new Error('Backend not healthy')
    return res.json()
}

// ---------------------------------------------------------------------------
// Instruction parsing
// ---------------------------------------------------------------------------

export async function uploadAssessmentAndGenerateSteps(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(await api('/analyze-instructions'), {
        method: 'POST',
        body: formData,
    })
    if (!response.ok) throw new Error('Failed to analyze instructions')
    return response.json()
}

export async function analyzeDocument(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(await api('/analyze-document'), {
        method: 'POST',
        body: formData,
    })
    if (!response.ok) throw new Error('Failed to analyze document')
    return response.json()
}

// ---------------------------------------------------------------------------
// Vision (operate on absolute image paths)
// ---------------------------------------------------------------------------

export async function generateScreenshotDescription(stepTitle: string, imagePath: string) {
    await assertCloudAllowed()
    const blob = await fileToBlob(imagePath)
    const formData = new FormData()
    formData.append('file', blob, 'screenshot.png')
    const response = await fetch(
        await api(`/generate-description?step_title=${encodeURIComponent(stepTitle)}`),
        { method: 'POST', body: formData }
    )
    if (!response.ok) throw new Error('Failed to generate description')
    return response.json() as Promise<{ description: string }>
}

export async function validateStep(stepTitle: string, stepDescription: string, imagePath: string) {
    await assertCloudAllowed()
    const blob = await fileToBlob(imagePath)
    const formData = new FormData()
    formData.append('file', blob, 'screenshot.png')
    const url = await api(
        `/validate-step?step_title=${encodeURIComponent(stepTitle)}&step_description=${encodeURIComponent(stepDescription)}`
    )
    const response = await fetch(url, { method: 'POST', body: formData })
    if (!response.ok) throw new Error('Failed to validate step')
    return response.json() as Promise<{ pass: boolean; confidence: number; message: string }>
}

export async function detectSensitive(imagePath: string) {
    await assertCloudAllowed()
    const blob = await fileToBlob(imagePath)
    const formData = new FormData()
    formData.append('file', blob, 'screenshot.png')
    const response = await fetch(await api('/detect-sensitive'), { method: 'POST', body: formData })
    if (!response.ok) throw new Error('Failed to detect sensitive data')
    return response.json() as Promise<{ regions: Array<{ x: number; y: number; width: number; height: number; type: string }> }>
}

export async function ocrImage(imagePath: string) {
    await assertCloudAllowed()
    const blob = await fileToBlob(imagePath)
    const formData = new FormData()
    formData.append('file', blob, 'screenshot.png')
    const response = await fetch(await api('/ocr'), { method: 'POST', body: formData })
    if (!response.ok) throw new Error('Failed to OCR image')
    return response.json() as Promise<{ text: string }>
}

// Smart crop: ask the vision model for the relevant region and (optionally) apply it.
export async function smartCrop(stepTitle: string, inputPath: string, opts: { apply?: boolean; outputPath?: string } = {}) {
    await assertCloudAllowed()
    const response = await fetch(await api('/smart-crop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input_path: inputPath,
            step_title: stepTitle,
            output_path: opts.outputPath,
            apply: opts.apply ?? false,
        }),
    })
    if (!response.ok) throw new Error('Failed to smart-crop')
    return response.json() as Promise<{ region: { x: number; y: number; width: number; height: number }; output_path?: string }>
}

// Suggest conditional branches (success/error paths) from steps + document context.
export async function suggestBranches(steps: any[], currentIndex = -1, documentText = '') {
    const response = await fetch(await api('/suggest-branches'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps, current_index: currentIndex, document_text: documentText }),
    })
    if (!response.ok) throw new Error('Failed to suggest branches')
    return response.json() as Promise<{ branches: Array<{ condition: string; title: string; description: string }> }>
}

// Suggest the next step from the defined manual steps + optional document context
// (not from screenshot content).
export async function suggestNextStep(steps: any[], currentIndex = -1, documentText = '') {
    const response = await fetch(await api('/suggest-next'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps, current_index: currentIndex, document_text: documentText }),
    })
    if (!response.ok) throw new Error('Failed to suggest next step')
    return response.json() as Promise<{ title: string; description: string }>
}

// ---------------------------------------------------------------------------
// Text generation
// ---------------------------------------------------------------------------

export async function generateCaptions(steps: any[]) {
    const response = await fetch(await api('/generate-captions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
    })
    if (!response.ok) throw new Error('Failed to generate captions')
    return response.json() as Promise<{ captions: Array<{ id: string; caption: string }> }>
}

export async function generateNarrative(title: string, steps: any[]) {
    const response = await fetch(await api('/generate-narrative'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, steps }),
    })
    if (!response.ok) throw new Error('Failed to generate narrative')
    return response.json() as Promise<{ introduction: string; conclusion: string }>
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export async function blurRegions(inputPath: string, regions: any[], outputPath?: string) {
    const response = await fetch(await api('/blur-regions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_path: inputPath, regions, output_path: outputPath }),
    })
    if (!response.ok) throw new Error('Failed to blur regions')
    return response.json() as Promise<{ output_path: string }>
}

export async function optimizeImage(inputPath: string, opts: { outputPath?: string; maxWidth?: number; quality?: number; format?: string } = {}) {
    const response = await fetch(await api('/optimize-image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input_path: inputPath,
            output_path: opts.outputPath,
            max_width: opts.maxWidth ?? 1920,
            quality: opts.quality ?? 85,
            format: opts.format,
        }),
    })
    if (!response.ok) throw new Error('Failed to optimize image')
    return response.json() as Promise<{ output_path: string }>
}

// ---------------------------------------------------------------------------
// Document export
// ---------------------------------------------------------------------------

export interface ReportBranding {
    title?: string
    author?: string
    subtitle?: string
    logo_path?: string
    header?: string
    watermark?: string
}

export interface GenerateReportParams {
    format: string
    title: string
    outputPath: string
    steps: any[]
    template?: string
    includeToc?: boolean
    includeLof?: boolean
    includeDescriptions?: boolean
    includeNotes?: boolean
    includeNarrative?: boolean
    introduction?: string
    conclusion?: string
    branding?: ReportBranding
}

export async function generateReport(params: GenerateReportParams) {
    const response = await fetch(await api('/generate-report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            format: params.format,
            title: params.title,
            output_path: params.outputPath,
            steps: params.steps,
            template: params.template ?? 'default',
            include_toc: params.includeToc ?? true,
            include_lof: params.includeLof ?? true,
            include_descriptions: params.includeDescriptions ?? true,
            include_notes: params.includeNotes ?? true,
            include_narrative: params.includeNarrative ?? false,
            introduction: params.introduction ?? '',
            conclusion: params.conclusion ?? '',
            branding: params.branding,
        }),
    })
    if (!response.ok) {
        const txt = await response.text()
        throw new Error(`Failed to generate report: ${txt}`)
    }
    return response.json() as Promise<{ success: boolean; output_path: string; format: string }>
}

// Insert captured figures into an existing .docx/.tex at placeholder locations.
export async function enhanceDocument(
    file: File,
    mappings: Array<{ placeholder: string; image_path: string; caption?: string }>,
    outputPath: string,
    startFigure = 1,
) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('mappings', JSON.stringify(mappings))
    formData.append('output_path', outputPath)
    formData.append('start_figure', String(startFigure))
    const response = await fetch(await api('/enhance-document'), { method: 'POST', body: formData })
    if (!response.ok) {
        const txt = await response.text()
        throw new Error(`Failed to enhance document: ${txt}`)
    }
    return response.json() as Promise<{ success: boolean; output_path: string }>
}

// Back-compat
export async function generateLatexReport(projectName: string, steps: any[], imagePaths: Record<string, string>) {
    const response = await fetch(await api('/generate-latex-report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: projectName,
            steps: steps.map(s => ({
                id: s.id,
                title: s.title,
                description: s.description,
                generated_description: s.generated_description || '',
            })),
            image_paths: imagePaths,
        }),
    })
    if (!response.ok) throw new Error('Failed to generate report')
    return response.json()
}
