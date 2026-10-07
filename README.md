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

## Pubblicazione online (gratuita): Neon + Render

- **Database: [Neon](https://neon.tech)**, PostgreSQL gestito con piano gratuito senza
  scadenza (0,5 GB). Si sospende quando non è usato e riparte in meno di un secondo.
- **App: [Render](https://render.com)**, servizio web gratuito da `Dockerfile` +
  `render.yaml`. Un solo servizio: API su `/api` e interfaccia sullo stesso indirizzo.

### 1. Database su Neon

1. Registrati su https://neon.tech e crea un progetto: nome `davegantt`, PostgreSQL 17,
   regione **AWS Europe Central 1 (Frankfurt)**.
2. Nella dashboard clicca **Connect**, disattiva **Connection pooling** e copia la
   connection string. Ha questa forma:
   `postgresql://neondb_owner:…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. Se termina con `&channel_binding=require`, togli quella parte (lascia `?sslmode=require`).

### 2. App su Render

1. Registrati su https://render.com con GitHub.
2. **New → Blueprint**, autorizza l'accesso al repository `daveGantt` e selezionalo.
3. Render legge `render.yaml` e chiede il valore di `DATABASE_URL`: incolla la stringa
   di Neon. Clicca **Apply**.
4. Al termine del primo build (alcuni minuti) l'app è su `https://davegantt.onrender.com`
   (o un nome simile mostrato da Render). Le tabelle vengono create da sole al primo avvio.
5. Condividi il link: i colleghi si registrano e li aggiungi con **Condividi**.

Ogni push su `main` ripubblica l'app automaticamente; i dati restano su Neon.

**Da sapere:** il servizio web gratuito si addormenta dopo 15 minuti senza visite, quindi la
prima apertura successiva impiega circa un minuto. Per evitarlo, passa il servizio al piano
"Starter" su Render.

Per provare l'immagine di produzione in locale:

```bash
docker build -t davegantt .
docker run --rm -p 3002:3001 -e COOKIE_SECURE=false \
  -e DATABASE_URL=postgresql://davegantt:davegantt@host.docker.internal:5432/davegantt \
  davegantt
```

## Struttura

```
apps/api         API Fastify + Prisma (PostgreSQL)
apps/web         Frontend React + Vite + Tailwind
packages/shared  Schemi zod e logica condivisa tra API e web
docs/            Piano e task list
```
