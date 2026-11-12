import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatMemberLabel } from '@/lib/customer/relationship'

const FOLD_GROUPS: readonly (readonly [string, string])[] = [
  ['ÁÀÄÂÃÅáàäâãå', 'a'],
  ['ÉÈËÊéèëê', 'e'],
  ['ÍÌÏÎíìïî', 'i'],
  ['ÓÒÖÔÕóòöôõ', 'o'],
  ['ÚÙÜÛúùüû', 'u'],
  ['Ññ', 'n'],
  ['Çç', 'c'],
  ['ÝŸýÿ', 'y'],
]

/** Se eliminan al plegar (guion blando, espacios de ancho cero). */
const FOLD_DELETE = '\u00AD\u200B\u200C\u200D\uFEFF\u2060'

function buildFoldMaps(): { from: string; to: string } {
  const seen = new Set<string>()
  let from = ''
  let to = ''
  for (const [chars, repl] of FOLD_GROUPS) {
    for (const ch of chars) {
      if (seen.has(ch)) throw new Error(`Carácter de búsqueda duplicado: ${ch}`)
      seen.add(ch)
      from += ch
      to += repl
    }
  }
  for (const ch of FOLD_DELETE) {
    if (seen.has(ch)) throw new Error(`Carácter de búsqueda duplicado: ${ch}`)
    seen.add(ch)
    from += ch
  }
  return { from, to }
}

/** Mapa para `translate()` en Postgres. Los caracteres de más en `from` se borran. */
export const { from: CUSTOMER_SEARCH_FOLD_FROM, to: CUSTOMER_SEARCH_FOLD_TO } = buildFoldMaps()

export type CustomerSearchable = {
  firstName: string
  lastName: string
  phone: string
  email?: string | null
  /** Nombre de una cita que coincide y no es el del titular. */
  matchedAs?: string | null
  members?: { firstName: string; relationship?: string }[]
}

/** Minúsculas, sin acentos ni signos, palabras separadas por un espacio. */
export function foldCustomerSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u00ad\u200b-\u200d\ufeff\u2060]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Separa el texto del teléfono. Los dígitos sueltos (`611 22 33 44`, `611-22-33-44`)
 * son un solo número: los espacios y los signos no cuentan.
 * Un dígito pegado a letras (`ana34`) sigue siendo texto.
 */
export function customerSearchQuery(query: string): { tokens: string[]; phoneDigits: string } {
  const words = foldCustomerSearchText(query).split(' ').filter(Boolean)
  const tokens = words.filter((word) => /[a-z]/.test(word))
  let phoneDigits = words.filter((word) => /^\d+$/.test(word)).join('')
  if (phoneDigits.startsWith('00')) phoneDigits = phoneDigits.slice(2)
  return { tokens, phoneDigits }
}

export function customerSearchTokens(query: string): string[] {
  return customerSearchQuery(query).tokens
}

function searchLabels(customer: CustomerSearchable): string[] {
  const labels = [formatCustomerDisplayName(customer.firstName, customer.lastName)]
  for (const member of customer.members ?? []) {
    const label = formatMemberLabel(member.firstName, member.relationship ?? '')
    if (label) labels.push(label)
  }
  if (customer.matchedAs?.trim()) labels.push(customer.matchedAs.trim())
  if (customer.email?.trim()) labels.push(customer.email.trim())
  return labels
}

/** 0 = palabra exacta o el teléfono entero, 1 = empieza por el texto, 2 = va dentro de otra palabra. */
export function customerSearchRank(
  customer: CustomerSearchable,
  tokens: string[],
  phoneDigits = '',
): number {
  const labels = searchLabels(customer).map(foldCustomerSearchText)
  const phone = customer.phone.replace(/\D/g, '')
  let total = 0
  if (phoneDigits) {
    if (phone === phoneDigits || phone.endsWith(phoneDigits)) total += 0
    else if (phone.includes(phoneDigits)) total += 1
    else total += 3
  }
  for (const token of tokens) {
    let best = 3
    for (const label of labels) {
      const words = label.split(' ').filter(Boolean)
      const compact = words.join('')
      if (words.some((word) => word === token) || compact === token) best = Math.min(best, 0)
      else if (words.some((word) => word.startsWith(token)) || compact.startsWith(token)) {
        best = Math.min(best, 1)
      } else if (label.includes(token) || compact.includes(token)) best = Math.min(best, 2)
    }
    total += best
  }
  return total
}

/** Nombre por el que ordenar: el que de verdad coincide («Ana»), no solo el titular. */
export function customerSearchSortName(customer: CustomerSearchable, tokens: string[]): string {
  const titular = formatCustomerDisplayName(customer.firstName, customer.lastName)
  const labels = searchLabels(customer)
  const letterTokens = tokens.filter((token) => /[a-z]/.test(token))
  const ranked = letterTokens.length > 0 ? letterTokens : tokens
  for (const token of ranked) {
    const exact = labels.find((label) => {
      const words = foldCustomerSearchText(label).split(' ').filter(Boolean)
      return words.some((word) => word === token) || words.join('') === token
    })
    if (exact) return exact
  }
  for (const token of ranked) {
    const prefix = labels.find((label) =>
      foldCustomerSearchText(label)
        .split(' ')
        .some((word) => word.startsWith(token)),
    )
    if (prefix) return prefix
  }
  return titular
}

export function compareCustomersBySearch<T extends CustomerSearchable>(
  a: T,
  b: T,
  tokens: string[],
  phoneDigits = '',
): number {
  const byRank =
    customerSearchRank(a, tokens, phoneDigits) - customerSearchRank(b, tokens, phoneDigits)
  if (byRank !== 0) return byRank
  const byName = customerSearchSortName(a, tokens).localeCompare(
    customerSearchSortName(b, tokens),
    'es',
    { sensitivity: 'base' },
  )
  if (byName !== 0) return byName
  return a.phone.localeCompare(b.phone)
}

/**
 * Texto extra en el buscador de cita: el miembro o la cita que coinciden
 * cuando el titular no se llama así.
 */
export function customerSearchHint(
  customer: CustomerSearchable,
  tokens: string[],
): string | null {
  if (tokens.length === 0) return null
  const titular = formatCustomerDisplayName(customer.firstName, customer.lastName)
  const sortName = customerSearchSortName(customer, tokens)
  if (foldCustomerSearchText(sortName) === foldCustomerSearchText(titular)) return null
  return sortName
}
