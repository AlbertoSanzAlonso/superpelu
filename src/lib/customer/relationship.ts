import type { Locale } from '@/i18n/types'

const RELATIONSHIP_MAX = 40

/** Texto libre. Recorta espacios y longitud. */
export function clipMemberRelationship(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, RELATIONSHIP_MAX)
}

/** «Antonio (hijo)». Sin parentesco, solo el nombre. */
export function formatMemberLabel(firstName: string, relationship: string): string {
  const name = firstName.trim()
  if (!name) return ''
  const label = clipMemberRelationship(relationship)
  return label ? `${name} (${label})` : name
}

/** «Antonio (hijo) de Luis». En inglés: «Antonio (hijo) of Luis». */
export function formatMemberAppointmentName(
  memberFirstName: string,
  relationship: string,
  titularFirstName: string,
  locale: Locale = 'es',
): string {
  const base = formatMemberLabel(memberFirstName, relationship)
  const titular = titularFirstName.trim()
  if (!base || !titular || !clipMemberRelationship(relationship)) return base
  return locale === 'en' ? `${base} of ${titular}` : `${base} de ${titular}`
}

/** «Noa Sanz (hija) de Alberto» → «Noa Sanz». Sin ese formato, el texto tal cual. */
export function memberNameWithoutKinship(displayName: string): string {
  return displayName.replace(/\s+\([^)]*\)\s+(?:de|of)\s+.+$/i, '').trim()
}
