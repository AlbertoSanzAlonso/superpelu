import { sql } from '@server/db.js'
import {
  CUSTOMER_SEARCH_FOLD_FROM,
  CUSTOMER_SEARCH_FOLD_TO,
  foldCustomerSearchText,
} from '@/lib/customer/search'

type SqlFragment = ReturnType<typeof sql>

function andAll(parts: SqlFragment[]): SqlFragment {
  return parts.reduce((acc, part) => sql`${acc} AND ${part}`)
}

function folded(column: SqlFragment): SqlFragment {
  return sql`regexp_replace(lower(translate(${column}, ${CUSTOMER_SEARCH_FOLD_FROM}, ${CUSTOMER_SEARCH_FOLD_TO})), '[^a-z0-9]+', '', 'g')`
}

function containsToken(column: SqlFragment, token: string): SqlFragment {
  return sql`${folded(column)} LIKE ${'%' + token + '%'}`
}

function textTokenMatch(token: string): SqlFragment {
  return sql`(
    ${containsToken(sql`c.first_name`, token)}
    OR ${containsToken(sql`COALESCE(c.last_name, '')`, token)}
    OR ${containsToken(sql`COALESCE(c.email, '')`, token)}
    OR EXISTS (
      SELECT 1 FROM customer_members m
      WHERE m.phone = c.phone
        AND (
          ${containsToken(sql`m.first_name`, token)}
          OR ${containsToken(sql`COALESCE(m.last_name, '')`, token)}
          OR ${containsToken(sql`COALESCE(m.relationship, '')`, token)}
        )
    )
    OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.customer_phone = c.phone
        AND ${containsToken(sql`a.customer_name`, token)}
    )
  )`
}

/**
 * Filtro de búsqueda sobre toda la tabla (no solo el primer bloque alfabético).
 * El teléfono se compara sin espacios ni signos: `611 22 33 44` y `611223344` son el mismo número.
 */
export function customerSearchWhere(tokens: string[], phoneDigits: string): SqlFragment {
  const parts: SqlFragment[] = tokens.map((token) => textTokenMatch(token))
  if (phoneDigits) {
    parts.push(
      sql`regexp_replace(c.phone, '[^0-9]', '', 'g') LIKE ${'%' + phoneDigits + '%'}`,
    )
  }
  if (parts.length === 0) return sql`TRUE`
  return andAll(parts)
}

/**
 * Última cita cuyo nombre coincide. Sirve para mostrar «Ana» cuando la ficha
 * del titular ya no se llama así.
 */
export function matchedAppointmentNameSelect(tokens: string[]): SqlFragment {
  const letterTokens = tokens.filter((token) => /[a-z]/.test(token))
  if (letterTokens.length === 0) return sql`NULL::text AS matched_appointment_name`
  return sql`(
    SELECT a.customer_name
    FROM appointments a
    WHERE a.customer_phone = c.phone
      AND ${andAll(letterTokens.map((token) => containsToken(sql`a.customer_name`, token)))}
    ORDER BY a.appointment_date DESC, a.start_time DESC
    LIMIT 1
  ) AS matched_appointment_name`
}

export function matchedAsFromSnapshot(
  firstName: string,
  lastName: string | null,
  snapshot: string | null,
  tokens: string[],
): string | null {
  const name = snapshot?.trim() ?? ''
  const letterTokens = tokens.filter((token) => /[a-z]/.test(token))
  if (!name || letterTokens.length === 0) return null
  const titular = foldCustomerSearchText(`${firstName} ${lastName ?? ''}`)
  if (letterTokens.every((token) => titular.includes(token))) return null
  return name
}
