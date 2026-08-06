import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

const stepLegendMobile = `${typography.label} mb-6 block w-full text-center md:hidden`

type Props = {
  title: string
  message: string
  acceptLabel: string
  declineLabel: string
  busy?: boolean
  onAccept: () => void
  onDecline: () => void
}

export function BookingForeignLocaleStep({
  title,
  message,
  acceptLabel,
  declineLabel,
  busy = false,
  onAccept,
  onDecline,
}: Props) {
  return (
    <div className="space-y-4">
      <p className={stepLegendMobile}>{title}</p>
      <div className="space-y-3">
        <p className={`${typography.body} text-center text-charcoal`}>{message}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="solid"
            className="w-full"
            disabled={busy}
            onClick={onAccept}
          >
            {acceptLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={onDecline}
          >
            {declineLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
