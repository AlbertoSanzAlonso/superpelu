type ServiceIconProps = {
  name: 'scissors' | 'palette' | 'sun' | 'sparkle'
  className?: string
}

export function ServiceIcon({ name, className = '' }: ServiceIconProps) {
  const stroke = 'currentColor'
  const props = {
    className: `h-8 w-8 text-gold ${className}`,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'scissors':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4L8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
        </svg>
      )
    case 'palette':
      return (
        <svg {...props}>
          <circle cx="13.5" cy="6.5" r=".5" fill={stroke} />
          <circle cx="17.5" cy="10.5" r=".5" fill={stroke} />
          <circle cx="8.5" cy="7.5" r=".5" fill={stroke} />
          <circle cx="6.5" cy="12.5" r=".5" fill={stroke} />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
      )
  }
}
