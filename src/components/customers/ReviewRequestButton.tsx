import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { sendCustomerReviewRequest, ApiError } from '@/lib/api'
import { canRequestGoogleReview } from '@/lib/customer/reviewRequest'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  adminToken: string
  phone: string
  reviewRequestSentAt: string | null
  appointment?: Appointment | null
  compact?: boolean
  inline?: boolean
  className?: string
  onSent?: (sentAt: string) => void
}

export function ReviewRequestButton({
  adminToken,
  phone,
  reviewRequestSentAt,
  appointment,
  compact = false,
  inline = false,
  className = '',
  onSent,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentAt, setSentAt] = useState(reviewRequestSentAt)

  useEffect(() => {
    setSentAt(reviewRequestSentAt)
  }, [reviewRequestSentAt])

  const effectiveSentAt = sentAt ?? reviewRequestSentAt
  const eligible = appointment ? canRequestGoogleReview(appointment) : true

  async function handleSend() {
    if (!phone.trim() || effectiveSentAt) return
    setBusy(true)
    setError('')
    try {
      const result = await sendCustomerReviewRequest(adminToken, phone, {
        appointmentId: appointment?.id,
      })
      setSentAt(result.reviewRequestSentAt)
      onSent?.(result.reviewRequestSentAt)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el WhatsApp')
    } finally {
      setBusy(false)
    }
  }

  if (effectiveSentAt) {
    const label = new Date(effectiveSentAt).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    if (inline) {
      return (
        <span
          className={`inline-flex h-9 w-full items-center justify-center text-xs text-charcoal-muted md:w-auto md:justify-start ${className}`.trim()}
          title={`Valoración enviada el ${label}`}
        >
          Valoración enviada
        </span>
      )
    }
    return (
      <p
        className={`${typography.caption} rounded border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-amber-950`}
        role="status"
      >
        Ya se envió la solicitud de valoración en Google ({label}).
      </p>
    )
  }

  if (appointment && !eligible) {
    if (inline) return null
    return (
      <p className={`${typography.caption} text-charcoal-muted`}>
        La valoración por WhatsApp está disponible cuando la cita ya ha pasado.
      </p>
    )
  }

  if (inline) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !phone.trim()}
          className={`h-9 w-full shrink-0 justify-center px-2.5 py-0 text-xs normal-case md:w-auto${error ? ' border-red-400' : ''} ${className}`.trim()}
          title={error || 'Enviar WhatsApp pidiendo valoración en Google'}
          onClick={(e) => {
            e.stopPropagation()
            void handleSend()
          }}
        >
          {busy ? 'Enviando…' : 'Valoración WhatsApp'}
        </Button>
      </>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'md'}
        disabled={busy || !phone.trim()}
        className={compact ? 'w-full' : undefined}
        onClick={() => void handleSend()}
      >
        {busy ? 'Enviando…' : 'Pedir valoración en Google (WhatsApp)'}
      </Button>
      {error && (
        <p className="text-center text-xs text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
