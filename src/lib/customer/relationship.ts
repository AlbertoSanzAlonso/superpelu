import type { Locale } from '@/i18n/types'

/** Parentesco respecto al titular. El valor guardado es la palabra en español. */
export const MEMBER_RELATIONSHIPS = [
  'hijo',
  'hija',
  'padre',
  'madre',
  'pareja',
  'esposo',
  'esposa',
  'hermano',
  'hermana',
  'abuelo',
  'abuela',
  'nieto',
  'nieta',
  'sobrino',
  'sobrina',
  'primo',
  'prima',
  'amigo',
  'amiga',
] as const

export type MemberRelationship = (typeof MEMBER_RELATIONSHIPS)[number]

const EN_LABEL: Record<MemberRelationship, string> = {
  hijo: 'son',
  hija: 'daughter',
  padre: 'father',
  madre: 'mother',
  pareja: 'partner',
  esposo: 'husband',
  esposa: 'wife',
  hermano: 'brother',
  hermana: 'sister',
  abuelo: 'grandfather',
  abuela: 'grandmother',
  nieto: 'grandson',
  nieta: 'granddaughter',
  sobrino: 'nephew',
  sobrina: 'niece',
  primo: 'cousin',
  prima: 'cousin',
  amigo: 'friend',
  amiga: 'friend',
}

export function normalizeMemberRelationship(value: string): MemberRelationship | '' {
  const key = value.trim().toLocaleLowerCase('es')
  return (MEMBER_RELATIONSHIPS as readonly string[]).includes(key)
    ? (key as MemberRelationship)
    : ''
}

export function memberRelationshipLabel(value: string, locale: Locale = 'es'): string {
  const key = normalizeMemberRelationship(value)
  if (!key) return ''
  return locale === 'en' ? EN_LABEL[key] : key
}

/** «Antonio (hijo)». Sin parentesco, solo el nombre. */
export function formatMemberLabel(
  firstName: string,
  relationship: string,
  locale: Locale = 'es',
): string {
  const name = firstName.trim()
  if (!name) return ''
  const label = memberRelationshipLabel(relationship, locale)
  return label ? `${name} (${label})` : name
}

/** «Antonio (hijo) de Luis». En inglés: «Antonio (son) of Luis». */
export function formatMemberAppointmentName(
  memberFirstName: string,
  relationship: string,
  titularFirstName: string,
  locale: Locale = 'es',
): string {
  const base = formatMemberLabel(memberFirstName, relationship, locale)
  const titular = titularFirstName.trim()
  if (!base || !titular || !memberRelationshipLabel(relationship, locale)) return base
  return locale === 'en' ? `${base} of ${titular}` : `${base} de ${titular}`
}
