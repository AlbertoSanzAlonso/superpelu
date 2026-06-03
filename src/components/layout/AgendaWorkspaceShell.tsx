import type { ReactNode } from 'react'
import { BrandWatermark } from '@/components/ui/BrandWatermark'

/** Vista de trabajo de agenda y clientes: marca de agua como en /reservar. */
export function AgendaWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-cream">
      <BrandWatermark variant="viewport" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
