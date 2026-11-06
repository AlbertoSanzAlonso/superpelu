import { useId } from 'react'
import type { Locale } from '@/i18n/types'
import {
  MEMBER_RELATIONSHIPS,
  memberRelationshipLabel,
  normalizeMemberRelationship,
} from '@/lib/customer/relationship'
import { typography } from '@/styles/typography'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  locale?: Locale
  className?: string
}

export function MemberRelationshipSelect({
  label,
  value,
  onChange,
  locale = 'es',
  className = '',
}: Props) {
  const selectId = useId()
  const placeholder = locale === 'en' ? 'Choose…' : 'Elige…'

  return (
    <label className="block text-left" htmlFor={selectId}>
      <span className={`${typography.label} mb-2 block`}>{label}</span>
      <select
        id={selectId}
        value={normalizeMemberRelationship(value)}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full cursor-pointer border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none focus:border-gold ${className}`}
      >
        <option value="">{placeholder}</option>
        {MEMBER_RELATIONSHIPS.map((id) => (
          <option key={id} value={id}>
            {memberRelationshipLabel(id, locale)}
          </option>
        ))}
      </select>
    </label>
  )
}
