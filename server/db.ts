export { sql, closeDatabase } from '@server/pg/client.js'
export { initDatabase } from '@server/pg/init.js'
export type {
  AppointmentRow,
  CustomerRow,
  ServiceCategoryRow,
  ServiceRow,
  StaffAvailabilityRow,
  StaffBlockRow,
  StaffRow,
} from '@server/pg/types.js'
