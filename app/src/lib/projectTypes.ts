// Project types and interfaces

export interface Step {
    id: string
    number: number
    title: string
    description: string
    imagePath: string | null
    captured: boolean
    skipped: boolean
}

export interface ProjectData {
    name: string
    createdAt: string
    updatedAt: string
    projectPath: string
    currentStepIndex: number
    steps: Step[]
}

// Helper to create a URL-safe slug from text
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 30)
}

// Generate screenshot filename from step
export function getStepFilename(step: Step): string {
    const paddedNumber = String(step.number).padStart(2, '0')
    const slug = slugify(step.title)
    return `step-${paddedNumber}-${slug}.png`
}
