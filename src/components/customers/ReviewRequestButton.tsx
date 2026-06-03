import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { sendCustomerReviewRequest, ApiError } from '@/lib/api'
import { canRequestGoogleReview } from '@/lib/reviewRequest'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  adminToken: string
  phone: string
  reviewRequestSentAt: string | null
  appointment?: Appointment | null
  compact?: boolean
  onSent?: (sentAt: string) => void
}

export function ReviewRequestButton({
  adminToken,
  phone,
  reviewRequestSentAt,
  appointment,
  compact = false,
  onSent,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentAt, setSentAt] = useState(reviewRequestSentAt)

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
    return (
      <p className={`${typography.caption} text-charcoal-muted`}>
        La valoración por WhatsApp está disponible cuando la cita ya ha pasado.
      </p>
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
