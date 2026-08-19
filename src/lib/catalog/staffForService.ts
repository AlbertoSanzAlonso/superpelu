import type { BookableService } from '@/types/booking'

export type StaffWithCategories = {
  id: string
  name: string
  categoryIds: string[]
  active?: boolean
}

export function categoryIdForBookableService(
  services: readonly BookableService[],
  serviceId: string,
): string | null {
  return services.find((s) => s.id === serviceId)?.categoryId ?? null
}

/** Profesionales activos cuya categoría incluye el tratamiento. */
export function filterStaffForService(
  serviceId: string,
  services: readonly BookableService[],
  staff: readonly StaffWithCategories[],
): { id: string; name: string }[] {
  if (!serviceId) {
    return staff
      .filter((member) => member.active !== false)
      .map((member) => ({ id: member.id, name: member.name }))
  }
  const categoryId = categoryIdForBookableService(services, serviceId)
  if (!categoryId) {
    return staff
      .filter((member) => member.active !== false)
      .map((member) => ({ id: member.id, name: member.name }))
  }
  return staff
    .filter(
      (member) => member.active !== false && member.categoryIds.includes(categoryId),
    )
    .map((member) => ({ id: member.id, name: member.name }))
}

/** Opciones de especialista para un tratamiento (conserva asignación actual si hace falta). */
export function staffOptionsForService(
  serviceId: string,
  services: readonly BookableService[],
  staffWithCategories: readonly StaffWithCategories[] | undefined,
  assignedStaffId: string,
  fallbackStaff: readonly { id: string; name: string }[],
): { id: string; name: string }[] {
  const eligible =
    staffWithCategories && staffWithCategories.length > 0
      ? filterStaffForService(serviceId, services, staffWithCategories)
      : [...fallbackStaff]

  if (assignedStaffId && !eligible.some((member) => member.id === assignedStaffId)) {
    const assigned = fallbackStaff.find((member) => member.id === assignedStaffId)
    if (assigned) return [assigned, ...eligible]
  }
  return eligible.length > 0 ? eligible : [...fallbackStaff]
}

/** Asigna el profesional más adecuado al elegir un tratamiento. */
export function resolveStaffAssignmentForService(
  serviceId: string,
  serviceIndex: number,
  currentAssignment: string | undefined,
  defaultStaffId: string | undefined,
  services: readonly BookableService[],
  staffWithCategories: readonly StaffWithCategories[] | undefined,
  fallbackStaff: readonly { id: string; name: string }[],
): string {
  const options = staffOptionsForService(
    serviceId,
    services,
    staffWithCategories,
    currentAssignment ?? '',
    fallbackStaff,
  )
  if (currentAssignment && options.some((member) => member.id === currentAssignment)) {
    return currentAssignment
  }
  if (
    serviceIndex === 0 &&
    defaultStaffId &&
    options.some((member) => member.id === defaultStaffId)
  ) {
    return defaultStaffId
  }
  return options[0]?.id ?? defaultStaffId ?? ''
}
