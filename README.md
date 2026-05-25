# Superpelu Hair Studio

Web premium para peluquería en Benalmádena, con estética dorada y crema, **agenda de citas integrada** y panel interno para el equipo.

## Stack

- React 19 + TypeScript + React Router
- Vite 6 + Tailwind CSS 4
- API Hono + SQLite (`better-sqlite3`)

## Rutas

| Ruta | Uso |
|------|-----|
| `/` | Web pública |
| `/reservar` | Reserva de citas (clientes) |
| `/agenda` | Agenda interna (equipo, con clave) |

## Desarrollo

```bash
npm install
cp .env.example .env   # opcional: cambia ADMIN_SECRET
npm run dev            # web :5173 + API :3001
```

- **Clientes:** [http://localhost:5173/reservar](http://localhost:5173/reservar)
- **Equipo:** [http://localhost:5173/agenda](http://localhost:5173/agenda) — clave por defecto `superpelu-dev-admin` (variable `ADMIN_SECRET`)

## Producción

```bash
npm run build
ADMIN_SECRET=tu-clave-segura npm start
```

Sirve el frontend desde `dist/` y la API en el mismo puerto (`PORT`, por defecto 3001). En despliegue detrás de nginx, proxy `/api` al proceso Node.

## Horario y servicios

Configurables en `server/config.ts`:

- Martes a sábado, 10:00–20:00
- Huecos cada 30 min
- Duración por servicio (coloración 120 min, balayage 150 min, etc.)

## Personalizar

- Textos y marca: `src/data/content.ts`
- Citas y horarios: `server/config.ts`
- Base de datos: `data/appointments.sqlite` (se crea sola)
