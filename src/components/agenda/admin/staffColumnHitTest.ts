/** Altura del encabezado de columna (debe coincidir con STAFF_HEADER_HEIGHT_CLASS). */
export const STAFF_COLUMN_HEADER_PX = 52

export function resolveStaffIdAtPointer(
  clientX: number,
  clientY: number,
  columnRefs: Map<string, HTMLDivElement>,
): string | null {
  const under = document.elementFromPoint(clientX, clientY)
  const columnEl = under?.closest('[data-staff-column-id]')
  if (columnEl instanceof HTMLElement) {
    const id = columnEl.dataset.staffColumnId
    if (id && columnEl.dataset.staffColumnWorking === 'true') return id
  }

  let bestId: string | null = null
  let bestDist = Infinity
  for (const [staffId, el] of columnRefs) {
    if (el.dataset.staffColumnWorking !== 'true') continue
    const rect = el.getBoundingClientRect()
    const pad = 28
    if (clientX < rect.left - pad || clientX > rect.right + pad) continue
    const centerX = (rect.left + rect.right) / 2
    const dist = Math.abs(clientX - centerX)
    if (dist < bestDist) {
      bestDist = dist
      bestId = staffId
    }
  }
  return bestId
}

export function pointerYInStaffGrid(
  clientY: number,
  staffId: string,
  columnRefs: Map<string, HTMLDivElement>,
  gridHeightPx: number,
): number | null {
  const el = columnRefs.get(staffId)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const y = clientY - rect.top - STAFF_COLUMN_HEADER_PX
  return Math.max(0, Math.min(gridHeightPx, y))
}
