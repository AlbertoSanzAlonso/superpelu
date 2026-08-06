import { useCallback, useRef, useState } from 'react'
import type { Locale } from '@/i18n/types'
import { isInternationalPhone, normalizePhone } from '@/lib/customer/phone'

/** Número extranjero y contexto aún en español → conviene preguntar idioma de avisos. */
export function shouldAskForeignPhoneLocale(phone: string, locale: Locale): boolean {
  return isInternationalPhone(phone) && locale !== 'en'
}

/**
 * Diálogo de idioma para ficha de cliente (p. ej. al editar).
 * En reserva web / agenda la pregunta va tras confirmar, no al salir del teléfono.
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
    if (!shouldAskForeignPhoneLocale(phone, locale)) return
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
