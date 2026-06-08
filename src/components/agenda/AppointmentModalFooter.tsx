import { ReviewRequestButton } from '@/components/customers/ReviewRequestButton'
import type { Appointment } from '@/types/booking'

type Props = {
  showReviewRequest: boolean
  adminToken?: string
  phone: string
  reviewRequestSentAt: string | null
  appointment: Appointment | null
  onReviewRequestSent?: (sentAt: string) => void
  children: React.ReactNode
}

export function AppointmentModalFooter({
  showReviewRequest,
  adminToken,
  phone,
  reviewRequestSentAt,
  appointment,
  onReviewRequestSent,
  children,
}: Props) {
  return (
    <footer className="flex shrink-0 flex-col gap-2 border-t border-gold/15 px-4 py-3 sm:px-5">
      {showReviewRequest && adminToken && phone.trim() && (
        <ReviewRequestButton
          adminToken={adminToken}
          phone={phone}
          reviewRequestSentAt={reviewRequestSentAt}
          appointment={appointment}
          compact
          onSent={onReviewRequestSent}
        />
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
    </footer>
  )
}
