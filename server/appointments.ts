/** Barrel: mantiene `@server/appointments.js` sin romper imports existentes. */
export {
  getAvailableSlots,
  getAvailableSlotsForServices,
  getServiceDaySlots,
  getServiceDaySlotsForServices,
  getStaffAvailableAtSlot,
  getStaffAvailableAtSlotForServices,
  type SlotOptions,
} from '@server/appointmentBooking.js'

export {
  parseServiceStartOverrides,
  resolveChainContinuation,
  type BookingChainSegmentPlan,
  type ChainContinuationResult,
} from '@server/appointmentChain.js'

export {
  createAppointment,
  getAppointmentSeriesMeta,
  type AppointmentSeriesMode,
  type CreateAppointmentInput,
} from '@server/appointmentCreate.js'

export {
  getAppointmentById,
  getAppointmentsByBookingGroup,
  listAppointments,
  listAppointmentsDueForReminder,
  listAppointmentsForStaff,
  markReminderSent,
} from '@server/appointmentQueries.js'

export {
  updateAppointmentForAdmin,
  updateAppointmentForStaff,
  type UpdateAppointmentInput,
} from '@server/appointmentUpdate.js'

export {
  cancelAppointment,
  cancelBookingGroupByCustomer,
  deleteAppointmentById,
  deleteAppointmentForStaff,
  markAppointmentNoShow,
  rescheduleAppointmentByCustomer,
  rowToPublic,
} from '@server/appointmentLifecycle.js'
