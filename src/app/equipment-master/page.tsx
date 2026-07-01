import { EquipmentMasterPage } from '@/modules/production/presentation/equipment-master-page'

export const metadata = {
  title: 'Equipment Master - BEF',
  description: 'Manage factory equipment and their parameters',
}

export default function EquipmentMasterRoute() {
  return <EquipmentMasterPage />
}
