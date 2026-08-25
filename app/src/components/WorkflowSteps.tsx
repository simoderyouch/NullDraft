import { useNavigate } from 'react-router-dom'
import { Check, PencilLine, ListChecks, Camera, FileDown } from 'lucide-react'

export type WorkflowStage = 'define' | 'review' | 'capture' | 'export'

const STAGES: { id: WorkflowStage; label: string; icon: typeof Check; route?: string }[] = [
  { id: 'define', label: 'Define', icon: PencilLine },
  { id: 'review', label: 'Review', icon: ListChecks },
  { id: 'capture', label: 'Capture', icon: Camera },
  { id: 'export', label: 'Export', icon: FileDown },
]

const ORDER: WorkflowStage[] = ['define', 'review', 'capture', 'export']

interface Props {
  current: WorkflowStage
  projectPath?: string | null
  className?: string
}

/**
 * A compact, app-wide pipeline indicator so users always know where they are
 * in the Define -> Review -> Capture -> Export flow. Completed stages are
 * clickable when a project path is available.
 */
export default function WorkflowSteps({ current, projectPath, className = '' }: Props) {
  const navigate = useNavigate()
  const currentIndex = ORDER.indexOf(current)

  const go = (stage: WorkflowStage) => {
    if (!projectPath) return
    const p = encodeURIComponent(projectPath)
    if (stage === 'define') navigate(`/edit?project=${p}`)
    else if (stage === 'review') navigate(`/review?project=${p}`)
    else if (stage === 'export') navigate(`/export?project=${p}`)
  }

  return (
    <div className={`flex items-center justify-center gap-1 sm:gap-2 ${className}`}>
      {STAGES.map((stage, i) => {
        const Icon = stage.icon
        const isDone = i < currentIndex
        const isCurrent = stage.id === current
        const reachable = !!projectPath && i <= currentIndex && stage.id !== 'capture'

        return (
          <div key={stage.id} className="flex items-center">
            <button
              type="button"
              disabled={!reachable || isCurrent}
              onClick={() => go(stage.id)}
              className={`group flex items-center gap-2.5 rounded-full pl-2 pr-4 py-2 text-sm transition-all
                ${isCurrent
                  ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground'
                  : isDone
                    ? 'text-foreground/90 hover:bg-primary/5 dark:hover:bg-white/10'
                    : 'text-muted-foreground/60'}
                ${reachable && !isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full font-bold
                  ${isCurrent ? 'bg-white/25' : isDone ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-muted dark:bg-white/5'}`}
              >
                {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="font-medium hidden sm:inline">{stage.label}</span>
            </button>
            {i < STAGES.length - 1 && (
              <div className={`h-px w-5 sm:w-9 mx-0.5 ${i < currentIndex ? 'bg-primary/50' : 'bg-border dark:bg-white/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
