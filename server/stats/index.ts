import { sql } from '@server/db.js'

export async function getStats() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const firstDayMonth = `${todayStr.slice(0, 7)}-01`
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString().slice(0, 10)

  const [
    totalAppointments,
    appointmentsThisMonth,
    newCustomers,
    topServices,
    topStaff,
    appointmentsByDay,
    appointmentsByMonth,
    originDistribution,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM appointments WHERE status != 'cancelled'`
      .then((r) => r[0]?.count ?? 0),

    sql`SELECT COUNT(*)::int AS count FROM appointments
        WHERE status != 'cancelled' AND appointment_date >= ${firstDayMonth}
          AND appointment_date <= ${todayStr}`
      .then((r) => r[0]?.count ?? 0),

    sql`SELECT COUNT(*)::int AS count FROM customers
        WHERE created_at >= ${thirtyDaysAgo}`
      .then((r) => r[0]?.count ?? 0),

    sql`
      SELECT service_id AS id, service_name AS name, COUNT(*)::int AS count
      FROM appointments
      WHERE status != 'cancelled'
      GROUP BY service_id, service_name
      ORDER BY count DESC
      LIMIT 10
    `,

    sql`
      SELECT staff_id AS id, staff_name AS name, COUNT(*)::int AS count
      FROM appointments
      WHERE status != 'cancelled' AND staff_id IS NOT NULL
      GROUP BY staff_id, staff_name
      ORDER BY count DESC
      LIMIT 10
    `,

    sql`
      SELECT appointment_date AS date, COUNT(*)::int AS count
      FROM appointments
      WHERE status != 'cancelled' AND appointment_date >= ${thirtyDaysAgo}
      GROUP BY appointment_date
      ORDER BY appointment_date ASC
    `,

    sql`
      SELECT
        to_char(date_trunc('month', created_at::timestamptz AT TIME ZONE 'Europe/Madrid'), 'YYYY-MM') AS month,
        COUNT(*)::int AS count
      FROM appointments
      WHERE status != 'cancelled'
        AND created_at >= ${sixMonthsAgo}
      GROUP BY month
      ORDER BY month ASC
    `,

    sql`
      SELECT
        COALESCE(origin, 'unknown') AS origin,
        COUNT(*)::int AS count
      FROM appointments
      WHERE status != 'cancelled'
      GROUP BY origin
      ORDER BY count DESC
    `,
  ])

  const totalOrigin = originDistribution.reduce((sum: number, r: { count: number }) => sum + r.count, 0)

  return {
    totalAppointments,
    appointmentsThisMonth,
    newCustomers,
    topServices,
    topStaff,
    appointmentsByDay,
    appointmentsByMonth,
    originDistribution: originDistribution.map((r: { origin: string; count: number }) => ({
      origin: r.origin,
      count: r.count,
      percentage: totalOrigin > 0 ? Math.round((r.count / totalOrigin) * 100) : 0,
    })),
  }
}

export type StatsResponse = Awaited<ReturnType<typeof getStats>>
