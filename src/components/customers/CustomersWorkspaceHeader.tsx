import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

type Props = {
  title?: string
  backTo?: { label: string; href: string }
  onLogout: () => void
  children?: React.ReactNode
}

export function CustomersWorkspaceHeader({
  title = 'Clientes',
  backTo,
  onLogout,
  children,
}: Props) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-gold/15 bg-cream px-3 py-2">
      {backTo ? (
        <Link
          to={backTo.href}
          className="border border-gold/30 px-2 py-1 text-xs text-charcoal-muted hover:border-gold"
        >
          ← {backTo.label}
        </Link>
      ) : null}
      <h1 className={`${typography.label} shrink-0 text-gold`}>{title}</h1>
      {children}
      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/agenda"
          className="border border-gold/30 px-2 py-1 text-xs text-charcoal-muted hover:border-gold"
        >
          Agenda
        </Link>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onLogout}>
          Salir
        </Button>
      </div>
    </header>
  )
}
