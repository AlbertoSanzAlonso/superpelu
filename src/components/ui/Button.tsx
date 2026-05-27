import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'

type BaseProps = {
  variant?: 'outline' | 'solid' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

const variants = {
  outline:
    'border border-gold/60 text-gold hover:border-gold hover:bg-gradient-to-r hover:from-gold/10 hover:via-gold-light/5 hover:to-gold/10 hover:text-gold-dark hover:shadow-[0_10px_28px_-16px_rgba(184,145,70,0.8)]',
  solid:
    'bg-gradient-to-r from-gold-light via-gold to-gold-dark text-cream shadow-[0_8px_20px_-12px_rgba(184,145,70,0.75)] hover:brightness-105 hover:shadow-[0_16px_34px_-14px_rgba(184,145,70,0.85)]',
  ghost: 'text-gold hover:text-gold-dark underline-offset-4 hover:underline',
}

const sizes = {
  sm: 'px-5 py-2 text-xs tracking-wide',
  md: 'px-8 py-3 text-xs tracking-wide',
  lg: 'px-10 py-4 text-sm tracking-wide',
}

function buttonClasses(variant: BaseProps['variant'], size: BaseProps['size'], className: string) {
  return `ui-rounded inline-flex cursor-pointer items-center justify-center font-sans uppercase transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ${variants[variant ?? 'outline']} ${sizes[size ?? 'md']} ${className}`
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

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>

  return (
    <button type={type} className={classes} {...buttonRest}>
      {children}
    </button>
  )
}
