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
} from '@server/appointments/booking.js'

export {
  parseServiceStartOverrides,
  resolveChainContinuation,
  type BookingChainSegmentPlan,
  type ChainContinuationResult,
} from '@server/appointments/chain.js'

export {
  createAppointment,
  getAppointmentSeriesMeta,
  type AppointmentSeriesMode,
  type CreateAppointmentInput,
} from '@server/appointments/create.js'

export {
  getAppointmentById,
  getAppointmentsByBookingGroup,
  listAppointments,
  listAppointmentsDueForReminder,
  listAppointmentsForStaff,
  markReminderSent,
} from '@server/appointments/queries.js'

export {
  updateAppointmentForAdmin,
  updateAppointmentForStaff,
  type UpdateAppointmentInput,
} from '@server/appointments/update.js'

export {
  cancelAppointment,
  cancelBookingGroupByCustomer,
  deleteAppointmentById,
  deleteAppointmentForStaff,
  markAppointmentNoShow,
  rescheduleAppointmentByCustomer,
  rowToPublic,
} from '@server/appointments/lifecycle.js'
