import { typography } from '@/styles/typography'

type BookingFormProgressProps = {
  step: number
  stepLabels: readonly string[]
  progressLabel: string
  backLabel: string
  onBack: () => void
}

export function BookingFormProgress({
  step,
  stepLabels,
  progressLabel,
  backLabel,
  onBack,
}: BookingFormProgressProps) {
  return (
    <>
      {step > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="ui-rounded absolute left-0 top-0 flex h-9 w-9 cursor-pointer items-center justify-center border border-gold/30 text-lg leading-none text-gold transition-colors hover:border-gold/60 hover:bg-gold/5 focus:outline-none focus:ring-2 focus:ring-gold/70"
          aria-label={backLabel}
        >
          ‹
        </button>
      )}

      <div className={`mb-6 text-center md:mb-8 ${step > 0 ? 'pt-1' : ''}`}>
        <p className={`${typography.caption} mb-2 hidden md:block`}>{progressLabel}</p>
        <h2 className={`${typography.h2} hidden md:block`}>{stepLabels[step]}</h2>
        <div className="flex justify-center gap-2 md:mt-5" aria-hidden>
          {stepLabels.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === step ? 'w-7 bg-gold' : index < step ? 'w-2.5 bg-gold/60' : 'w-2.5 bg-gold/20'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  )
}
