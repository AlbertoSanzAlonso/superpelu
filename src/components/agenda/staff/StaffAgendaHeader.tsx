import { Button } from '@/components/ui/Button'
import type { StaffSession } from '@/lib/staffApi'
import { typography } from '@/styles/typography'

type Props = {
  staff: StaffSession
  onLogout: () => void
}

export function StaffAgendaHeader({ staff, onLogout }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className={`${typography.h3} text-gold`}>Hola, {staff.name}</p>
        {staff.role && <p className={typography.caption}>{staff.role}</p>}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onLogout}>
        Salir
      </Button>
    </div>
  )
}
