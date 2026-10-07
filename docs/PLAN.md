# daveGantt — Piano di implementazione

Web app per la pianificazione di progetti con diagrammi di Gantt, ispirata a Instagantt.
Questo documento è il riferimento per scope, architettura e fasi. Le regole operative per lo sviluppo sono in `CLAUDE.md`.

## 1. Decisioni prese

| Tema   | Decisione                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------ |
| Stack  | Monorepo pnpm: React + TypeScript + Vite (web), Node + Fastify (api), PostgreSQL + Prisma        |
| Utenti | Multi-utente: login, workspace condivisi, ruoli OWNER / EDITOR / VIEWER, assegnatari sui task    |
| MVP    | Gantt base (task, sottotask, milestone, dipendenze, drag & drop) + vista lista/tabella editabile |

## 2. Scope MVP

Incluso:

- Registrazione, login, logout (email + password).
- Workspace con membri e ruoli; invito di un utente già registrato tramite email.
- Progetti: crea, rinomina, archivia, colore.
- Task gerarchici: gruppo (riepilogo), task, milestone; sottotask a più livelli; riordino.
- Campi task: nome, descrizione, data inizio, data fine, avanzamento %, assegnatario, colore, stato.
- Vista split: griglia editabile a sinistra, timeline Gantt a destra, scroll verticale sincronizzato.
- Timeline: zoom giorno / settimana / mese / trimestre, linea "oggi", weekend evidenziati.
- Interazioni sulla timeline: sposta barra, ridimensiona inizio/fine, trascina avanzamento, crea dipendenza trascinando da una barra all'altra.
- Dipendenze FS / SS / FF / SF con lag in giorni, frecce disegnate, rilevamento cicli.
- Ripianificazione automatica dei successori quando un predecessore si sposta (vedi §7).
- Date dei gruppi calcolate dai figli (rollup).
- Expand/collapse dei rami, selezione multipla base, scorciatoie tastiera essenziali.

Fuori scope MVP (backlog): workload risorse, export PDF/PNG/Excel, collaborazione realtime, baseline, critical path, vista board/kanban, portfolio multi-progetto, integrazioni (Asana, Jira), SSO, notifiche email, undo/redo multilivello.

## 3. Architettura

```
daveGantt/
├── apps/
│   ├── web/          React 19 + Vite + TS
│   └── api/          Fastify + Prisma
├── packages/
│   └── shared/       schemi zod, tipi, motore di scheduling (TS puro, nessuna dipendenza da DOM/DB)
├── docs/
├── docker-compose.yml   PostgreSQL per sviluppo e test
└── CLAUDE.md
```

### Frontend (`apps/web`)

- Routing: React Router.
- Server state: TanStack Query (cache, optimistic update, invalidazione).
- UI state locale (zoom, selezione, rami collassati, drag in corso): Zustand.
- Stile: Tailwind CSS + componenti Radix/shadcn per dialog, menu, popover, form.
- Righe virtualizzate con TanStack Virtual, **una sola sorgente di righe** condivisa da griglia e timeline.
- Gantt renderizzato in **SVG custom** (vedi §5), riordino righe in griglia con dnd-kit.

### Backend (`apps/api`)

- Fastify con type provider zod; validazione input e output con gli schemi di `packages/shared`.
- Prisma + PostgreSQL; migrazioni versionate.
- Autenticazione: sessioni server-side in Postgres, cookie `httpOnly`, `Secure`, `SameSite=Lax`; password con argon2id.
- Protezione CSRF: SameSite + header custom obbligatorio sulle richieste mutanti.
- Autorizzazione centralizzata: ogni accesso a progetto/task risolve la membership del workspace e verifica il ruolo lato server.
- Concorrenza ottimistica: colonna `version` sui task, `409 Conflict` se la versione non coincide.

### Motore di scheduling (`packages/shared/scheduling`)

Funzioni pure, usate dal client per l'anteprima durante il drag e dal server come fonte autorevole:

- aritmetica delle date di calendario (stringhe `YYYY-MM-DD`), giorni lavorativi;
- propagazione delle dipendenze (FS/SS/FF/SF + lag);
- rilevamento cicli;
- rollup delle date dei gruppi;
- validazione (fine ≥ inizio, milestone a durata zero).

## 4. Modello dati (prima versione)

```
User            id, email (unique), name, passwordHash, createdAt
Session         id, userId, expiresAt, createdAt
Workspace       id, name, createdAt
WorkspaceMember workspaceId, userId, role (OWNER|EDITOR|VIEWER)   PK(workspaceId, userId)
Project         id, workspaceId, name, color, archivedAt, createdAt, updatedAt
Task            id, projectId, parentId?, type (GROUP|TASK|MILESTONE), name, description,
                startDate (DATE), endDate (DATE, inclusiva), progress (0-100),
                status, color?, assigneeId?, sortKey (fractional index), version,
                createdById, createdAt, updatedAt
Dependency      id, projectId, predecessorId, successorId, type (FS|SS|FF|SF), lagDays
                unique(predecessorId, successorId)
```

Note:

- `startDate`/`endDate` sono colonne `DATE` (nessun orario, nessun fuso).
- `sortKey` con fractional indexing per riordinare senza riscrivere i fratelli.
- Cancellazione di un task: cancella sottotask e dipendenze collegate (cascade), previa conferma in UI.

## 5. Scelta del rendering Gantt

Raccomandazione: **implementazione custom in SVG**.

- dhtmlx-gantt è GPL (licenza commerciale per uso aziendale chiuso), Bryntum è commerciale.
- frappe-gantt e gantt-task-react sono MIT ma limitati (niente griglia ad albero, dipendenze e personalizzazione ridotte) o poco mantenuti.
- Il nucleo (scala data↔pixel, barre, frecce, drag) è un problema ben delimitato e testabile; il controllo totale serve per un'UX stile Instagantt.

Alternativa da valutare con uno spike di mezza giornata nella Fase 3: SVAR React Gantt (core MIT). Se copre griglia + dipendenze + drag in modo soddisfacente si adotta e si risparmiano le Fasi 3 e 5 in parte.

## 6. API (bozza)

```
POST   /auth/register | /auth/login | /auth/logout      GET /auth/me
GET    /workspaces                                       POST /workspaces
GET    /workspaces/:id/members                           POST /workspaces/:id/members   PATCH/DELETE .../:userId
GET    /workspaces/:id/projects                          POST /workspaces/:id/projects
GET    /projects/:id            (progetto + task + dipendenze in un'unica risposta)
PATCH  /projects/:id            DELETE /projects/:id (archivia)
POST   /projects/:id/tasks      PATCH /tasks/:id         DELETE /tasks/:id
POST   /tasks/:id/move          (cambio parent / sortKey)
POST   /projects/:id/schedule   (modifica date di uno o più task; il server ripianifica e restituisce tutti i task cambiati)
POST   /projects/:id/dependencies                        DELETE /dependencies/:id
```

## 7. Assunzioni da confermare

1. **Ripianificazione**: spostare un predecessore in avanti spinge i successori; spostarlo indietro **non** li tira indietro (comportamento push-only). Un successore non può essere trascinato prima del vincolo: viene bloccato al limite.
2. **Calendario**: sabato e domenica non lavorativi, nessuna festività nell'MVP; durata e lag in giorni lavorativi.
3. **Inviti**: nell'MVP si aggiunge al workspace solo un utente già registrato (nessun invio email, nessun SMTP).
4. **Lingua UI**: italiano, senza framework i18n nell'MVP.
5. **Deploy**: non definito; l'MVP gira in locale con docker-compose. Target di deploy da decidere prima della Fase 7.
6. **Volumi**: fino a ~2.000 task per progetto con interazione fluida (obiettivo di performance).

## 8. Fasi (slice verticali)

Ogni fase termina con test verdi, typecheck e lint puliti, e verifica manuale del flusso nell'app.

**Fase 0 — Scheletro**
`git init`, monorepo pnpm, TS strict, ESLint + Prettier, Vitest, docker-compose Postgres, Prisma init, Fastify con `/health`, web Vite che chiama `/health`. Script `dev`, `test`, `lint`, `typecheck`, `db:migrate`.
_Done_: `pnpm dev` avvia web + api, la home mostra lo stato dell'API.

**Fase 1 — Autenticazione e workspace**
Register/login/logout, sessioni, workspace personale creato alla registrazione, guard di autorizzazione, pagina di login.
_Done_: test di integrazione su auth e su accesso negato a workspace altrui.

**Fase 2 — Progetti e vista lista (primo slice end-to-end completo)**
CRUD progetti; CRUD task gerarchici; griglia con colonne nome/inizio/fine/durata/avanzamento/assegnatario; editing inline; indent/outdent; riordino drag; expand/collapse.
_Done_: creo un progetto con gruppi, task e sottotask dalla griglia; tutto persiste; un VIEWER non può modificare (verificato lato server).

**Fase 3 — Timeline Gantt in sola lettura**
Scala temporale e header multilivello, zoom, barre/milestone/gruppi, linea oggi, weekend, scroll sincronizzato con la griglia, virtualizzazione. Spike SVAR (§5).
_Done_: progetto da 2.000 task scorre fluido; le barre corrispondono alle date in griglia.

**Fase 4 — Motore di scheduling (TDD)**
Package `shared/scheduling`: date di calendario, giorni lavorativi, propagazione dipendenze, cicli, rollup. Endpoint `/schedule` e dipendenze lato API.
_Done_: copertura test completa dei 4 tipi di dipendenza, lag positivi/negativi, cicli, catene lunghe.

**Fase 5 — Interazioni sulla timeline**
Drag sposta/ridimensiona/avanzamento con anteprima ottimistica (motore lato client), creazione dipendenze trascinando, frecce, eliminazione dipendenze, creazione task trascinando su riga vuota, gestione `409`.
_Done_: E2E Playwright: sposto un task con successori e verifico la ripianificazione dopo reload.

**Fase 6 — Collaborazione base**
Gestione membri e ruoli, assegnatari, filtri (assegnatario, stato), colori, ricerca task.
_Done_: test di autorizzazione per ogni ruolo sugli endpoint mutanti.

**Fase 7 — Hardening**
Scorciatoie tastiera, stati vuoti/errore, test di performance, accessibilità di base (navigazione tastiera nella griglia, contrasto), rate limiting su login, revisione sicurezza.

## 9. Rischi

| Rischio                             | Mitigazione                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Bug di fuso orario sulle date       | Date di calendario solo come stringhe `YYYY-MM-DD` e colonne `DATE`; mai `Date` JS per date di calendario |
| Divergenza scheduling client/server | Stesso motore in `packages/shared`; il server è autorevole e restituisce i task cambiati                  |
| Performance su progetti grandi      | Virtualizzazione righe e colonne temporali, rendering SVG solo della finestra visibile, misure in Fase 3  |
| Modifiche concorrenti               | `version` ottimistica + `409` + refetch; realtime rimandato                                               |
| Complessità drag & drop             | Pointer events nativi con logica di drag isolata e testabile, nessuna libreria generica per le barre      |
