import { brand } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { Divider } from '@/components/ui/Divider'
import { typography } from '@/styles/typography'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gold/15 bg-cream-dark section-padding py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center">
        <Logo size="sm" />
        <Divider />
        <p className={typography.caption}>
          © {year} {brand.name} {brand.tagline}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
