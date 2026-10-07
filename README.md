# daveGantt

Web app multi-utente per la pianificazione di progetti con diagrammi di Gantt.

## Requisiti

- Node 22 (`.nvmrc`), pnpm 10
- Docker (per PostgreSQL)

## Avvio in locale

```bash
docker compose up -d
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter @davegantt/api db:generate
pnpm db:migrate
pnpm dev
```

Apri http://localhost:5173.

## Comandi

| Comando           | Descrizione                               |
| ----------------- | ----------------------------------------- |
| `pnpm dev`        | API (porta 3001) e web (porta 5173)       |
| `pnpm test`       | Test Vitest di tutti i package            |
| `pnpm lint`       | ESLint                                    |
| `pnpm typecheck`  | Controllo dei tipi TypeScript             |
| `pnpm format`     | Prettier                                  |
| `pnpm db:migrate` | Crea/applica migrazioni Prisma (sviluppo) |

## Struttura

```
apps/api         Fastify + Prisma
apps/web         React + Vite
packages/shared  Schemi zod e logica condivisa
docs/            Piano e task list
```
