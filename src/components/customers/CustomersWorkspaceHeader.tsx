import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

type Props = {
  title?: string
  backTo?: { label: string; href: string }
  onLogout: () => void
  children?: React.ReactNode
}

export const customersWorkspaceLinkClass =
  'inline-flex h-9 shrink-0 items-center border border-gold/30 px-2.5 text-xs text-charcoal-muted hover:border-gold'

export const customersWorkspaceButtonClass = 'h-9 shrink-0 px-3 py-0'

const headerLinkClass = customersWorkspaceLinkClass

export function CustomersWorkspaceHeader({
  title = 'Clientes',
  backTo,
  onLogout,
  children,
}: Props) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-gold/15 bg-cream px-3 py-2">
      {backTo ? (
        <Link to={backTo.href} className={headerLinkClass}>
          ← {backTo.label}
        </Link>
      ) : null}
      <h1 className={`${typography.label} shrink-0 text-gold`}>{title}</h1>
      {children}
      <div className="ml-auto flex items-center gap-2">
        <Link to="/agenda" className={headerLinkClass}>
          Agenda
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={customersWorkspaceButtonClass}
          onClick={onLogout}
        >
          Salir
        </Button>
      </div>
    </header>
  )
}
