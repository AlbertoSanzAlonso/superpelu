/** Clases tipográficas centralizadas — jerarquía de marca */
export const typography = {
  display: 'font-serif text-4xl md:text-5xl lg:text-6xl uppercase tracking-brand text-charcoal',
  h1: 'font-serif text-3xl md:text-4xl uppercase tracking-brand text-charcoal',
  h2: 'font-serif text-2xl md:text-3xl uppercase tracking-brand text-gold',
  h3: 'font-serif text-xl md:text-2xl uppercase tracking-wide text-charcoal',
  script: 'font-script text-3xl md:text-4xl text-gold',
  body: 'font-sans text-sm md:text-base font-light leading-relaxed text-charcoal-muted',
  label: 'font-sans text-xs uppercase tracking-wide text-gold',
  caption: 'font-sans text-xs uppercase tracking-wide text-charcoal-muted',
} as const
