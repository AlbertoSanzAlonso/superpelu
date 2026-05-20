type DividerProps = {
  className?: string
  variant?: 'gold' | 'light'
}

export function Divider({ className = '', variant = 'gold' }: DividerProps) {
  const color =
    variant === 'light' ? 'bg-cream/40' : 'bg-gradient-to-r from-transparent via-gold to-transparent'

  return (
    <div
      className={`mx-auto h-px w-24 max-w-full ${color} ${className}`}
      aria-hidden
    />
  )
}
