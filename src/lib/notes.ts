/** Vista previa de texto largo en listas y celdas de agenda. */
export function truncateNotesPreview(
  text: string | null | undefined,
  maxLen = 48,
): string | undefined {
  const trimmed = text?.trim()
  if (!trimmed) return undefined
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1)}…`
}
