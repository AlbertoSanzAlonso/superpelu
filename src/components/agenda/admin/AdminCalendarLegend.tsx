import { serviceCategories } from '@/data/serviceCategories'
import { categoryLabelFor } from '@/lib/servicePicker'
import { categoryLegendSwatch } from '@/lib/serviceCategoryColors'

export function AdminCalendarLegend() {
  return (
    <div className="mb-2 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-1 text-[11px] text-charcoal-muted">
      {serviceCategories.map((cat) => (
        <span key={cat.id} className="flex items-center gap-1">
          <span
            className={`inline-block h-2.5 w-4 border ${categoryLegendSwatch[cat.id] ?? 'bg-gold/15 border-gold/40'}`}
          />
          {categoryLabelFor(cat.id)}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-4 border border-dashed border-charcoal/25 bg-charcoal/5" />
        Bloqueado
      </span>
    </div>
  )
}
