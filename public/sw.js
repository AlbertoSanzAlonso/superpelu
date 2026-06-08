self.addEventListener('push', (event) => {
  let payload = { title: 'Superpelu', body: 'Novedad en la agenda', url: '/agenda' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // payload por defecto
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const agendaFocused = clientList.some(
        (client) => client.url.includes('/agenda') && client.visibilityState === 'visible',
      )
      if (agendaFocused) return

      return self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `superpelu-agenda-${payload.appointmentId ?? Date.now()}`,
        data: { url: payload.url ?? '/agenda' },
      })
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/agenda'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/agenda') && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    }),
  )
})
