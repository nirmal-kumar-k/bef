import { redirect } from 'next/navigation'
import { getSessionUser } from '@/shared/lib/auth'
import { ActivityPage } from '@/modules/activity/presentation/activity-page'

export default async function Activity() {
  const session = await getSessionUser()
  if (!session || session.role !== 'admin') {
    redirect('/dashboard')
  }
  return <ActivityPage />
}
