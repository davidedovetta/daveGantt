# daveGantt

Web app multi-utente per pianificare progetti con diagrammi di Gantt (ispirata a Instagantt).
Scope, architettura, modello dati, fasi e assunzioni aperte: **`docs/PLAN.md`** — leggilo prima di iniziare una fase nuova.

## Stato

Fasi 0 e 1 completate: scheletro, autenticazione (sessioni + cookie), workspace con ruoli, login/registrazione e layout nel web. Condivisione dei workspace (T6.1–T6.2) e Fase 2 (progetti, tabella task gerarchica modificabile) completate, salvo riordino con drag (T2.14). Prossima: Fase 3 (timeline Gantt).
Aggiorna questa sezione e "Comandi" quando cambiano.

Backlog operativo: **`docs/TASKS.md`**. Si lavora un task alla volta, nell'ordine indicato: segna `[~]` quando inizi, `[x]` solo quando test, typecheck e lint sono verdi e il comportamento è verificato. I task con ⚠️ richiedono conferma dell'utente prima di procedere.

## Stack

- Monorepo **pnpm workspaces**, TypeScript `strict` ovunque.
- `apps/web`: React 19, Vite, React Router, TanStack Query (server state), Zustand (UI state), TanStack Virtual, Tailwind + Radix/shadcn, dnd-kit (solo riordino righe in griglia).
- `apps/api`: Node LTS, Fastify con type provider zod, Prisma, PostgreSQL.
- `packages/shared`: schemi zod, tipi condivisi, motore di scheduling.
- Test: Vitest (unit + integrazione API su Postgres reale), Playwright (E2E).

### Note sulle versioni (non ovvie)

- **TypeScript fissato a `~6.0`**: typescript-eslint non supporta ancora TS 7. In TS 6 `types` va dichiarato in ogni `tsconfig.json`.
- **Prisma 7** (`~7.10`, non la 8 RC che npm marca `latest`): generator `prisma-client` con output in `apps/api/src/generated/prisma` (gitignored, si rigenera con `pnpm --filter @davegantt/api db:generate`), datasource URL in `apps/api/prisma.config.ts`, client creato con driver adapter `@prisma/adapter-pg` (`src/db.ts`). Import dal client: `./generated/prisma/client.js`.
- **React Router v8**: `createBrowserRouter` da `react-router`, `RouterProvider` da `react-router/dom`.
- **Zod 4** + `fastify-type-provider-zod` v7.
- `packages/shared` esporta sorgenti TS (nessuna build): li consumano Vite e `tsx`.

## Comandi

```bash
docker compose up -d     # Postgres locale
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev                 # api su :3001, web su http://localhost:5173 (proxy /api → api)
pnpm test                # tutti i test Vitest
pnpm test:e2e            # Playwright (da aggiungere in Fase 5)
pnpm lint
pnpm typecheck
pnpm format
pnpm db:generate         # client Prisma
pnpm db:deploy           # applica migrazioni esistenti
pnpm db:migrate          # prisma migrate dev (nuove migrazioni)
```

- Vite ascolta su `localhost` (IPv6 `::1`): usare `http://localhost:5173`, non `127.0.0.1`.
- Le route API non hanno prefisso: il prefisso `/api` esiste solo nel proxy di Vite.
- In sviluppo il cookie di sessione non è `Secure` (Safari lo rifiuta su `http://localhost`); in produzione sì. Override con `COOKIE_SECURE`.

### Pattern già stabiliti (riusarli)

- Errori API: lanciare `AppError` / `unauthorized()` / `forbidden()` / `notFound()` da `apps/api/src/errors.ts`; il formato di uscita è sempre `{ error: { code, message } }` (`apiErrorSchema`), messaggi in italiano.
- Utente corrente: `requireUser(request)`; permessi: `requireWorkspaceRole(db, userId, workspaceId, minRole)` in `apps/api/src/authz.ts` (non membro → 404, ruolo insufficiente → 403).
- Test API: `buildTestApp()`, `resetDb()` in `beforeEach`, `registerUser()` per ottenere cookie autenticati, `csrfHeaders` per le richieste mutanti (`apps/api/test/helpers.ts`).
- Web: chiamate solo tramite `apiRequest()` (`apps/web/src/lib/api.ts`, aggiunge l'header CSRF e converte gli errori in `ApiError`); hook TanStack Query per feature in `apps/web/src/features/<feature>/api.ts`. Un 401 su qualsiasi query azzera l'utente e riporta al login.
- I test API usano il database `davegantt_test` (`TEST_DATABASE_URL`); il global setup applica le migrazioni con `prisma migrate deploy` e rifiuta database il cui nome non termina con `_test`. Non usare `prisma migrate reset` dai tool: Prisma lo blocca quando invocato da un agente AI e richiede il consenso esplicito dell'utente.

Prima di dichiarare finito un task: `pnpm typecheck && pnpm lint && pnpm test` devono passare.

## Regole di dominio (non negoziabili)

- **Date di calendario** (`startDate`, `endDate`, scadenze): sempre stringhe `YYYY-MM-DD` nel codice e nelle API, colonne `DATE` nel DB. Mai `new Date()` / timestamp per rappresentarle. Usa solo le utility di `packages/shared` per l'aritmetica sulle date.
- `endDate` è **inclusiva**. Una milestone ha `startDate === endDate` e durata zero.
- Durate e lag sono in **giorni lavorativi** (sab/dom esclusi nell'MVP).
- Il **motore di scheduling** vive solo in `packages/shared/scheduling`, è composto da funzioni pure senza I/O ed è l'unica implementazione: il client lo usa per l'anteprima, il server per il risultato autorevole. Non duplicare logica di scheduling in web o api.
- Non esiste un tipo `GROUP`: un task con sottotask è un riepilogo, con date e avanzamento derivati dai figli (`rollup` in `packages/shared/scheduling`); l'API rifiuta modifiche dirette a date/avanzamento dei riepiloghi (`SUMMARY_READ_ONLY`).
- `sortKey` (fractional indexing) si confronta byte per byte in JS (`compareKeys`): non usare `ORDER BY sortKey`, la collation di Postgres lo ordina male.
- Le dipendenze non possono formare cicli: validare lato server prima di salvare.
- Le regole di ripianificazione e le altre assunzioni aperte sono in `docs/PLAN.md` §7: non cambiarle né inventarne di nuove senza chiedere.

## Regole di sicurezza

- Ogni endpoint che tocca workspace/progetti/task/dipendenze passa dal guard di autorizzazione centralizzato (membership del workspace + ruolo). Mai fidarsi di `workspaceId`/`projectId` inviati dal client senza verificarli.
- VIEWER: sola lettura. EDITOR: modifica contenuti. OWNER: anche membri e impostazioni del workspace.
- Validare con zod input **e** output di ogni route (l'output non deve esporre `passwordHash` o dati di altri workspace).
- Sessioni server-side, cookie `httpOnly` + `Secure` + `SameSite=Lax`; richieste mutanti richiedono l'header custom anti-CSRF.
- Password con argon2id. Niente segreti nel repo: configurazione da `.env` (con `.env.example` versionato).
- Ogni nuova route mutante ha un test di integrazione che verifica il rifiuto per utenti non membri e per VIEWER.

## Convenzioni di codice

- Codice, identificatori, commit e commenti in **inglese**; testi dell'interfaccia in **italiano**.
- Schemi zod in `packages/shared` come unica fonte dei tipi di API; i tipi TS si derivano con `z.infer`.
- Frontend: dati dal server solo tramite TanStack Query (niente fetch nei componenti); stato UI effimero in Zustand. Componenti piccoli, logica di calcolo (scala temporale, posizionamento barre, hit-testing del drag) in moduli puri testabili separati dai componenti.
- Gantt: rendering SVG custom; griglia e timeline condividono la stessa lista di righe virtualizzata — non introdurre una seconda sorgente di righe.
- Concorrenza: ogni update di task invia `version`; gestire `409` con refetch e messaggio all'utente.
- Riordino con `sortKey` (fractional indexing): non rinumerare i fratelli.
- Migrazioni Prisma sempre versionate; mai modificare una migrazione già applicata.
- Niente dipendenze nuove senza motivo esplicito; in particolare niente librerie Gantt GPL/commerciali (dhtmlx, Bryntum).

## Test

- `packages/shared/scheduling`: TDD, copertura di tutti i tipi di dipendenza (FS/SS/FF/SF), lag positivi e negativi, cicli, catene lunghe, rollup.
- API: test di integrazione su Postgres reale (database di test dedicato), incluse le verifiche di autorizzazione.
- Web: unit test per i moduli puri (scala, layout, drag); Playwright per i flussi principali (login, crea progetto, crea task, sposta task con successori).

## Workflow

- Lavorare per fasi come in `docs/PLAN.md` §8, una slice verticale alla volta; a fine fase verificare il flusso nell'app reale, non solo i test.
- Le funzionalità fuori scope MVP (§2 del piano) non si implementano senza richiesta esplicita.
