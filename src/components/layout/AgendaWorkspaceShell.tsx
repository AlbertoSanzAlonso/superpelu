import type { ReactNode } from 'react'

/** Vista de trabajo de agenda: sin cabecera de marca ni títulos de página. */
export function AgendaWorkspaceShell({ children }: { children: ReactNode }) {
  return <div className="flex h-screen flex-col overflow-hidden bg-cream">{children}</div>
}
