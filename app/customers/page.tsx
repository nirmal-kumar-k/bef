import { AppLayout } from '../app-layout'
import { EmptyState } from '@/components/empty-state'

export default function CustomersPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground font-heading mb-2">
            Customers
          </h1>
          <p className="text-muted-foreground">
            Client and account management
          </p>
        </div>

        <EmptyState
          title="Coming Soon"
          description="Customer database, contact information, and relationship management will be available here."
          icon="👥"
        />
      </div>
    </AppLayout>
  )
}
