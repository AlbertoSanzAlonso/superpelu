/** API pública de citas — `@server/appointments/index.js` */
export {
  getAvailableSlots,
  getAvailableSlotsForServices,
  getOverHoursSlotsForServices,
  getServiceDaySlots,
  getServiceDaySlotsForServices,
  getStaffAvailableAtSlot,
  getStaffAvailableAtSlotForServices,
  type SlotOptions,
} from './booking.js'

export {
  parseServiceStartOverrides,
  resolveChainContinuation,
  type BookingChainSegmentPlan,
  type ChainContinuationResult,
} from './chain.js'

export {
  createAppointment,
  getAppointmentSeriesMeta,
  type AppointmentSeriesMode,
  type CreateAppointmentInput,
} from './create.js'

export {
  getAppointmentById,
  getAppointmentsByBookingGroup,
  listAppointments,
  listAppointmentsDueForReminder,
  listAppointmentsForStaff,
  markReminderSent,
} from './queries.js'

export {
  updateAppointmentForAdmin,
  updateAppointmentForStaff,
  type UpdateAppointmentInput,
} from './update.js'

export {
  cancelAppointment,
  cancelBookingGroupByCustomer,
  deleteAppointmentById,
  deleteAppointmentForStaff,
  markAppointmentNoShow,
  rescheduleAppointmentByCustomer,
  rowToPublic,
} from './lifecycle.js'
