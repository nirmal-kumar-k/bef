'use client'

import { EmptyState } from '@/shared/ui/empty-state'
import { useRole } from '@/shared/context/role-context'

export default function ReportsPage() {
  const { role } = useRole()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground font-heading mb-2">
          Reports
        </h1>
        <p className="text-muted-foreground">
          Analytics and business intelligence
        </p>
      </div>

      <EmptyState
        title="Coming Soon"
        description="Financial reports, production analytics, and performance metrics will be available here."
        icon="📈"
      />
    </div>
  )
}
