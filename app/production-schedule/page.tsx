import { AppLayout } from '../app-layout'
import { EmptyState } from '@/components/empty-state'

export default function ProductionSchedulePage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground font-heading mb-2">
            Production Schedule
          </h1>
          <p className="text-muted-foreground">
            Timeline and resource planning
          </p>
        </div>

        <EmptyState
          title="Coming Soon"
          description="Production calendar, shift planning, and resource allocation will be managed here."
          icon="📅"
        />
      </div>
    </AppLayout>
  )
}
