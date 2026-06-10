import { useState, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Edit2, Trash2, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepItemProps {
  stepNumber: number
  title: string
  description: string
  onUpdate: (title: string, description: string) => void
  onDelete: () => void
  dragHandle?: ReactNode
  isDragging?: boolean
}

export default function StepItem({
  stepNumber,
  title,
  description,
  onUpdate,
  onDelete,
  dragHandle,
  isDragging
}: StepItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [editDescription, setEditDescription] = useState(description)

  const handleSave = () => {
    onUpdate(editTitle, editDescription)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(title)
    setEditDescription(description)
    setIsEditing(false)
  }

  return (
    <Card
      className={cn(
        "mb-3 transition-colors border-muted/40 hover:border-muted/70",
        isDragging && "shadow-lg scale-[1.02] border-primary/20",
        isEditing && "border-primary/50"
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Drag Handle Area or Number */}
          <div className="flex flex-col items-center justify-center pl-3 pr-2 border-r border-muted/20 bg-muted/5 min-w-[50px]">
            {dragHandle || (
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold text-sm">
                {stepNumber}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 p-4">
            {isEditing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Step Title"
                    className="font-bold text-lg bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Step Description"
                    className="resize-none min-h-[100px] bg-background/50"
                  />
                </div>
                <div className="flex gap-2 pt-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={handleCancel}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-1">
                  <h3 className="text-base font-semibold text-foreground leading-none mb-2">
                    {title || <span className="text-muted-foreground italic">Untitled Step</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {description || <span className="text-muted-foreground/50 italic">No description provided</span>}
                  </p>
                </div>

                <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-md border border-border/50 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="h-7 w-7"
                    title="Edit Step"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Delete Step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

