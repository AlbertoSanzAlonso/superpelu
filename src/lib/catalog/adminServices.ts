import type { AdminService } from '@/lib/api/admin-catalog'
import type { BookableService } from '@/types/booking'

export function mapAdminServiceToBookable(service: AdminService): BookableService {
  return {
    id: service.id,
    nameEs: service.nameEs,
    nameEn: service.nameEn,
    durationMinutes: service.durationMinutes,
    categoryId: service.categoryId,
    bookingPattern: service.bookingPattern,
  }
}
