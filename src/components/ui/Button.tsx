import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'

type BaseProps = {
  variant?: 'outline' | 'solid' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

const variants = {
  outline:
    'border border-gold/60 text-gold hover:bg-gold/5 hover:border-gold transition-colors',
  solid:
    'bg-gradient-to-r from-gold-light via-gold to-gold-dark text-cream hover:opacity-90 transition-opacity',
  ghost: 'text-gold hover:text-gold-dark underline-offset-4 hover:underline',
}

const sizes = {
  sm: 'px-5 py-2 text-xs tracking-wide',
  md: 'px-8 py-3 text-xs tracking-wide',
  lg: 'px-10 py-4 text-sm tracking-wide',
}

function buttonClasses(variant: BaseProps['variant'], size: BaseProps['size'], className: string) {
  return `inline-flex items-center justify-center font-sans uppercase transition-all duration-300 ${variants[variant ?? 'outline']} ${sizes[size ?? 'md']} ${className}`
}

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never }

type ButtonAsLink = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = 'outline', size = 'md', children, className = '', ...rest } = props
  const classes = buttonClasses(variant, size, className)

  if ('href' in props && props.href) {
    const { href, ...linkRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
    return (
      <a href={href} className={classes} {...linkRest}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
