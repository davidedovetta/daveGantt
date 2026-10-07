# daveGantt

Web app multi-utente per pianificare progetti con diagrammi di Gantt, ispirata a Instagantt.

## Stato attuale

| Disponibile                                                    | In arrivo                                |
| -------------------------------------------------------------- | ---------------------------------------- |
| Registrazione, login, logout                                   | Progetti e vista lista dei task (Fase 2) |
| Workspace personali e condivisi                                | Timeline Gantt (Fase 3)                  |
| Condivisione con i colleghi: ruoli Proprietario/Editor/Lettore | Dipendenze e ripianificazione (Fasi 4–5) |

Piano completo in [docs/PLAN.md](docs/PLAN.md), avanzamento in [docs/TASKS.md](docs/TASKS.md).

## Requisiti

- **Node 22** (vedi `.nvmrc`)
- **pnpm 10** (`corepack enable` oppure `npm i -g pnpm`)
- **Docker Desktop** in esecuzione (serve per PostgreSQL)

## Primo avvio

```bash
git clone https://github.com/davidedovetta/daveGantt.git
cd daveGantt

docker compose up -d                        # PostgreSQL su localhost:5432
pnpm install
cp apps/api/.env.example apps/api/.env      # configurazione locale dell'API
pnpm db:generate                            # genera il client Prisma
pnpm db:deploy                              # crea le tabelle nel database
pnpm dev                                    # avvia API e web
```

Apri **http://localhost:5173**.

## Avvii successivi

```bash
docker compose up -d
pnpm dev
```

Dopo un `git pull` che porta nuove dipendenze o migrazioni:

```bash
pnpm install && pnpm db:generate && pnpm db:deploy
```

Per fermare tutto: `Ctrl+C` nel terminale di `pnpm dev`, poi `docker compose down`
(i dati restano nel volume Docker; `docker compose down -v` li cancella).

## Primo utilizzo

1. Vai su http://localhost:5173 e clicca **Registrati**: viene creato il tuo workspace personale.
2. Per lavorare con un collega, il collega si registra a sua volta.
3. Nel workspace clicca **Condividi**, inserisci la sua email e scegli il ruolo:
   - **Proprietario**: modifica e gestisce i membri
   - **Editor**: modifica progetti e task
   - **Lettore**: sola lettura
4. Il collega vede il workspace nella barra laterale dopo aver ricaricato la pagina.

Per provare da solo con due utenti usa una finestra normale e una anonima del browser.

## Comandi

| Comando            | Descrizione                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `pnpm dev`         | API su http://localhost:3001, web su http://localhost:5173         |
| `pnpm test`        | Test di tutti i package (richiede Postgres attivo)                 |
| `pnpm lint`        | ESLint                                                             |
| `pnpm typecheck`   | Controllo dei tipi TypeScript                                      |
| `pnpm format`      | Prettier                                                           |
| `pnpm db:generate` | Rigenera il client Prisma                                          |
| `pnpm db:deploy`   | Applica le migrazioni al database di sviluppo                      |
| `pnpm db:migrate`  | Crea una nuova migrazione dopo una modifica allo schema (sviluppo) |

## Problemi comuni

- **`Cannot connect to the Docker daemon`** → avvia Docker Desktop e ripeti `docker compose up -d`.
- **Porta 5432 occupata** (un altro Postgres locale) → fermalo, oppure cambia la porta in `docker-compose.yml` e in `apps/api/.env`.
- **La pagina dice "Impossibile contattare il server"** → l'API non è partita: controlla l'output di `pnpm dev` (di solito Postgres spento o `.env` mancante).
- **Usa `localhost`, non `127.0.0.1`**: Vite risponde solo su `localhost`.
- **`Cannot find module './generated/prisma/client.js'`** → esegui `pnpm db:generate`.

## Struttura

```
apps/api         API Fastify + Prisma (PostgreSQL)
apps/web         Frontend React + Vite + Tailwind
packages/shared  Schemi zod e logica condivisa tra API e web
docs/            Piano e task list
```
