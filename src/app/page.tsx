import { EmptyState } from '@/shared/ui/empty-state'

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground font-heading mb-2">
          Welcome to BEF Foundry
        </h1>
        <p className="text-muted-foreground">
          Advanced metalworks management system
        </p>
      </div>

      <EmptyState
        title="Dashboard"
        description="Select a module from the sidebar to begin managing your foundry operations."
        icon="⚙️"
      />
    </div>
  )
}
