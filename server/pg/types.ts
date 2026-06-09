export type CustomerRow = {
  phone: string
  first_name: string
  last_name: string | null
  email: string | null
  notes: string | null
  locale: string
  review_request_sent_at: string | null
  created_at: string
  updated_at: string
}

export type AppointmentRow = {
  id: string
  staff_id: string | null
  staff_name: string | null
  service_id: string
  service_name: string
  duration_minutes: number
  appointment_date: string
  start_time: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  status: string
  created_at: string
  reminder_sent_at: string | null
  locale: string
  /** Par color + lavado: mismo UUID en ambas filas. */
  color_group_id: string | null
  /** `color` = fase de coloración; `wash` = lavar color. */
  color_group_role: string | null
  /** Varias citas de la misma reserva pública (misma visita). */
  booking_group_id: string | null
  /** Serie periódica (agenda): mismo tratamiento repetido. */
  series_id: string | null
  scope: string | null
}

export type StaffRow = {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  password_hash: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type StaffBlockRow = {
  id: string
  staff_id: string
  block_date: string
  start_time: string
  end_time: string
  note: string | null
  series_id: string | null
  scope: string | null
  created_at: string
}

export type ServiceCategoryRow = {
  id: string
  name_es: string
  name_en: string
  active: boolean
  sort_order: number
  price_from_cents: number | null
  price_note: string | null
  created_at: string
  updated_at: string
}

export type ServiceRow = {
  id: string
  name: string
  name_en: string | null
  duration_minutes: number
  category_id: string | null
  bookable_online: boolean
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type StaffAvailabilityRow = {
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
}
