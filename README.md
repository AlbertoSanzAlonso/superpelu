# Superpelu Hair Studio

Web premium para peluquería, con estética dorada y crema inspirada en la identidad visual de la marca.

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4 (tema centralizado en `src/styles/`)

## Estructura

```
src/
├── components/
│   ├── layout/     # Header, Footer
│   ├── sections/   # Hero, Services, Studio, Gallery, Contact
│   └── ui/         # Button, Logo, Section, Divider, ServiceIcon
├── data/           # Contenido y textos de marca
└── styles/         # theme.css, index.css, typography.ts
```

## Desarrollo

```bash
npm install
npm run dev
```

## Personalizar

Edita `src/data/content.ts` con teléfono, email, dirección y enlace de WhatsApp reales.
