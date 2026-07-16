import { redirect } from 'next/navigation'
import { getSessionUser } from '@/shared/lib/auth'
import { UsersMasterPage } from '@/modules/users/presentation/users-master-page'

export default async function UsersPage() {
  const session = await getSessionUser()
  if (!session || session.role !== 'admin') {
    redirect('/dashboard')
  }

  return <UsersMasterPage />
}
