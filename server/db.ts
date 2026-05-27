export { sql, closeDatabase } from './pg/client.js'
export { initDatabase } from './pg/init.js'
export type {
  AppointmentRow,
  CustomerRow,
  ServiceCategoryRow,
  ServiceRow,
  StaffAvailabilityRow,
  StaffBlockRow,
  StaffRow,
} from './pg/types.js'
