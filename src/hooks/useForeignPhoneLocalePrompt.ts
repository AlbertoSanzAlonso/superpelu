import { useCallback, useRef, useState } from 'react'
import type { Locale } from '@/i18n/types'
import { isInternationalPhone, normalizePhone } from '@/lib/customer/phone'

/**
 * Al salir del campo teléfono: si es extranjero y el idioma sigue en español,
 * pregunta si pasar a inglés (una vez por número normalizado).
 */
export function useForeignPhoneLocalePrompt(
  phone: string,
  locale: Locale,
  onSwitchToEnglish: () => void,
) {
  const [open, setOpen] = useState(false)
  const handledForPhoneRef = useRef<string | null>(null)

  const maybePrompt = useCallback(() => {
    const normalized = normalizePhone(phone)
    if (!isInternationalPhone(phone)) return
    if (locale === 'en') return
    if (handledForPhoneRef.current === normalized) return
    setOpen(true)
  }, [phone, locale])

  const accept = useCallback(() => {
    handledForPhoneRef.current = normalizePhone(phone)
    onSwitchToEnglish()
    setOpen(false)
  }, [phone, onSwitchToEnglish])

  const decline = useCallback(() => {
    handledForPhoneRef.current = normalizePhone(phone)
    setOpen(false)
  }, [phone])

  return { open, maybePrompt, accept, decline }
}
