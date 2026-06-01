import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
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

function EyeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

function EyeSlashIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  )
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  error?: string
}

export function PasswordInput({ label, id, className = '', error, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const errorId = error ? `${inputId}-error` : undefined
  const toggleId = `${inputId}-toggle`

  return (
    <label className="block text-left" htmlFor={inputId}>
      <span className={`${typography.label} mb-2 block`}>{label}</span>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`${fieldClass} pr-12 ${error ? 'border-red-600 focus:border-red-600' : ''} ${className}`}
          {...props}
        />
        <button
          id={toggleId}
          type="button"
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-charcoal-muted transition-colors hover:text-charcoal"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-controls={inputId}
          aria-pressed={visible}
        >
          {visible ? <EyeSlashIcon /> : <EyeIcon />}
        </button>
      </div>
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
