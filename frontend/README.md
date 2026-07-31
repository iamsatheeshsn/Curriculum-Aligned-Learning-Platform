# Stemora Frontend

React + Vite + Tailwind monorepo for the K-12 STEM & Tutoring Platform.

## Apps

| App | Port | Description |
| --- | --- | --- |
| `@stemora/website` | 5173 | Public marketing site |
| `@stemora/control` | 5174 | Super Admin + Tenant Owner |
| `@stemora/institution` | 5175 | School + Teacher (`/:tenantSlug`) |
| `@stemora/learner` | 5176 | Student + Parent |

## Quick start

```bash
npm install
npm run dev:website
```

See `docs/PUBLIC-WEBSITE-Phase18.md` in the repo root docs folder.
