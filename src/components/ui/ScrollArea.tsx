import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'

type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { children, className = '', style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`scrollbar-premium ${className}`}
      style={{ WebkitOverflowScrolling: 'touch', ...style }}
      {...rest}
    >
      {children}
    </div>
  )
})

