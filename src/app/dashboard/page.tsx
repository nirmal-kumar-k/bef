import { EmptyState } from '@/shared/ui/empty-state'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground font-heading mb-2">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Production metrics and operational overview
          </p>
        </div>

        <EmptyState
          title="Coming Soon"
          description="Dashboard metrics and visualizations will be available here. Monitor your foundry&apos;s performance in real-time."
          icon="📊"
        />
      </div>
  )
}
