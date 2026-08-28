import { sql } from '@server/db.js'
import { addDaysToDateString, todaySalon } from '@/lib/core/dates'

export type StatsFilter = {
  from: string
  to: string
}

export async function getStats(filter?: StatsFilter) {
  const today = todaySalon()
  const firstDayMonth = `${today.slice(0, 7)}-01`
  const thirtyDaysAgo = addDaysToDateString(today, -30)
  const sixMonthsAgo = new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1 - 5,
    1,
  )
    .toISOString()
    .slice(0, 10)

  const hasFilter = Boolean(filter?.from && filter?.to)
  const from = filter?.from ?? ''
  const to = filter?.to ?? ''

  const apptWhere = hasFilter
    ? sql`status != 'cancelled' AND appointment_date >= ${from} AND appointment_date <= ${to}`
    : sql`status != 'cancelled'`

  const dayFrom = hasFilter ? from : thirtyDaysAgo
  const dayTo = hasFilter ? to : today

  const [
    appointmentCount,
    appointmentsThisMonth,
    newCustomers,
    topServices,
    topStaff,
    appointmentsByDay,
    appointmentsByMonth,
    originDistribution,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM appointments WHERE ${apptWhere}`
      .then((r) => r[0]?.count ?? 0),

    hasFilter
      ? Promise.resolve(null)
      : sql`SELECT COUNT(*)::int AS count FROM appointments
            WHERE status != 'cancelled' AND appointment_date >= ${firstDayMonth}
              AND appointment_date <= ${today}`
          .then((r) => r[0]?.count ?? 0),

    hasFilter
      ? sql`
          SELECT COUNT(*)::int AS count FROM customers
          WHERE (created_at AT TIME ZONE 'Europe/Madrid')::date >= ${from}
            AND (created_at AT TIME ZONE 'Europe/Madrid')::date <= ${to}
        `.then((r) => r[0]?.count ?? 0)
      : sql`SELECT COUNT(*)::int AS count FROM customers
            WHERE created_at >= ${thirtyDaysAgo}`
          .then((r) => r[0]?.count ?? 0),

    sql`
      SELECT service_id AS id, service_name AS name, COUNT(*)::int AS count
      FROM appointments
      WHERE ${apptWhere}
      GROUP BY service_id, service_name
      ORDER BY count DESC
      LIMIT 10
    `,

    sql`
      SELECT staff_id AS id, staff_name AS name, COUNT(*)::int AS count
      FROM appointments
      WHERE ${apptWhere} AND staff_id IS NOT NULL
      GROUP BY staff_id, staff_name
      ORDER BY count DESC
      LIMIT 10
    `,

    sql`
      SELECT appointment_date AS date, COUNT(*)::int AS count
      FROM appointments
      WHERE status != 'cancelled'
        AND appointment_date >= ${dayFrom}
        AND appointment_date <= ${dayTo}
      GROUP BY appointment_date
      ORDER BY appointment_date ASC
    `,

    hasFilter
      ? sql`
          SELECT
            to_char(date_trunc('month', appointment_date::date), 'YYYY-MM') AS month,
            COUNT(*)::int AS count
          FROM appointments
          WHERE ${apptWhere}
          GROUP BY month
          ORDER BY month ASC
        `
      : sql`
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
      WHERE ${apptWhere}
      GROUP BY origin
      ORDER BY count DESC
    `,
  ])

  const originList = originDistribution as unknown as { origin: string; count: number }[]
  const totalOrigin = originList.reduce((sum, r) => sum + r.count, 0)

  return {
    period: hasFilter ? { from, to } : null,
    appointmentCount,
    appointmentsThisMonth,
    newCustomers,
    topServices,
    topStaff,
    appointmentsByDay,
    appointmentsByMonth,
    originDistribution: originList.map((r) => ({
      origin: r.origin,
      count: r.count,
      percentage: totalOrigin > 0 ? Math.round((r.count / totalOrigin) * 100) : 0,
    })),
  }
}

export type StatsResponse = Awaited<ReturnType<typeof getStats>>
