import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { typography } from '@/styles/typography'

const fieldClass =
  'w-full border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export function Input({ label, id, className = '', error, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <label className="block text-left" htmlFor={inputId}>
      <span className={`${typography.label} mb-2 block`}>{label}</span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`${fieldClass} ${error ? 'border-red-600 focus:border-red-600' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </label>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
}

export function Textarea({ label, id, className = '', ...props }: TextareaProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <label className="block text-left" htmlFor={inputId}>
      <span className={`${typography.label} mb-2 block`}>{label}</span>
      <textarea
        id={inputId}
        className={`${fieldClass} min-h-[100px] resize-y ${className}`}
        {...props}
      />
    </label>
  )
}
