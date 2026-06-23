import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EmptyStateProps {
  title: string
  description: string
  icon?: React.ReactNode
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <Card className="border-2 border-dashed border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 font-heading">
          {icon && <span className="text-accent text-2xl">{icon}</span>}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
