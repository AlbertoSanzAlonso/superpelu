type Props = {
  className?: string
  title?: string
}

/** Gota de agua — fase de lavado en citas de coloración enlazadas. */
export function WashPhaseIcon({ className = 'h-3.5 w-3.5 shrink-0', title }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.32 0L12 2.69Z" />
    </svg>
  )
}
