import { normalizePhone } from '@/lib/phone'

export function dash(value: string | null | undefined): string {
  const t = value?.trim()
  return t ? t : '—'
}

export function whatsappHref(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, '')
  return `https://wa.me/${digits}`
}
