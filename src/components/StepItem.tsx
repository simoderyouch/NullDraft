import { Checkbox } from './ui/checkbox'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Edit2, X } from 'lucide-react'

interface StepItemProps {
  stepNumber: number
  title: string
  caption: string
  checked: boolean
  onToggle: (checked: boolean) => void
  onEdit: () => void
  onSkip: () => void
}

export default function StepItem({
  stepNumber,
  title,
  caption,
  checked,
  onToggle,
  onEdit,
  onSkip,
}: StepItemProps) {
  return (
    <Card className="mb-3 transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="pt-1">
            <Checkbox
              checked={checked}
              onCheckedChange={onToggle}
              id={`step-${stepNumber}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-muted-foreground">
                Step {stepNumber}
              </span>
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {caption}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="h-8"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="h-8 text-muted-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Skip
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

