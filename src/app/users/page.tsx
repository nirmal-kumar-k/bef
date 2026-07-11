import { EmptyState } from '@/shared/ui/empty-state'

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground font-heading mb-2">
          Users & Access
        </h1>
        <p className="text-muted-foreground">
          Team management and permissions
        </p>
      </div>

      <EmptyState
        title="Coming Soon"
        description="User accounts, role management, and access control settings will be available here."
        icon="🔐"
      />
    </div>
  )
}
