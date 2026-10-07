# daveGantt — Task list

Backlog operativo derivato da `docs/PLAN.md` §8. Si implementa in ordine, un task alla volta.
Ogni task è chiuso solo quando: codice + test scritti, `pnpm typecheck && pnpm lint && pnpm test` verdi, comportamento verificato.

Legenda: `[ ]` da fare · `[~]` in corso · `[x]` fatto · ⚠️ dipende da un'assunzione aperta (PLAN §7)

---

## Fase 0 — Scheletro

- [x] **T0.1** `git init`, `.gitignore`, `.editorconfig`, `.nvmrc` (Node LTS), rimozione del file vuoto `d` (previa conferma).
- [x] **T0.2** Monorepo pnpm: `pnpm-workspace.yaml`, `package.json` root con script `dev`, `test`, `lint`, `typecheck`, `format`; `tsconfig.base.json` strict.
- [x] **T0.3** ESLint (flat config) + Prettier condivisi per tutto il monorepo.
- [x] **T0.4** `packages/shared`: package TS con build/exports, Vitest configurato, un test di esempio.
- [x] **T0.5** `docker-compose.yml` con Postgres (db `davegantt` + db `davegantt_test`), `.env.example`.
- [x] **T0.6** `apps/api`: Fastify + type provider zod, config da env validata con zod, route `GET /health` che verifica la connessione al DB, logger pino.
- [x] **T0.7** Prisma in `apps/api`: schema vuoto iniziale, script `db:migrate`, `db:reset`, client singleton.
- [x] **T0.8** Setup test di integrazione API: Vitest su `davegantt_test`, reset DB tra le suite, helper `buildApp()` con `app.inject`. Test su `/health`.
- [x] **T0.9** `apps/web`: Vite + React 19 + TS, Tailwind, React Router, TanStack Query; proxy Vite verso l'API; home che mostra lo stato di `/health`.
- [x] **T0.10** `pnpm dev` avvia api + web in parallelo; README minimo con setup locale; aggiornare la sezione "Stato" di `CLAUDE.md`.

## Fase 1 — Autenticazione e workspace

- [x] **T1.1** Schema Prisma: `User`, `Session`, `Workspace`, `WorkspaceMember` (enum `Role`) + migrazione.
- [x] **T1.2** Schemi zod condivisi per auth (`registerInput`, `loginInput`, `meOutput`).
- [x] **T1.3** Servizio password (argon2id) e servizio sessioni (crea, valida, revoca, scadenza).
- [x] **T1.4** Plugin Fastify di autenticazione: lettura cookie, `request.user`, decorator `requireAuth`; header anti-CSRF obbligatorio sulle richieste mutanti.
- [x] **T1.5** Route `POST /auth/register` (crea utente + workspace personale con ruolo OWNER), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Test: casi felici, email duplicata, credenziali errate, sessione scaduta.
- [x] **T1.6** Rate limiting su `/auth/login` e `/auth/register`.
- [x] **T1.7** Guard di autorizzazione centralizzato: `requireWorkspaceRole(workspaceId, minRole)` Test unit sulla gerarchia dei ruoli. (`requireProjectRole` spostato in T2.5: serve il modello `Project`.)
- [x] **T1.8** Route `GET /workspaces`, `POST /workspaces`. Test: un utente vede solo i propri workspace.
- [x] **T1.9** Web: client API (fetch wrapper con header CSRF e gestione errori), pagine Login e Registrazione, route protette, logout, query `me`.
- [x] **T1.10** Web: layout applicativo (sidebar con workspace e progetti, header utente), selettore workspace.

## Fase 2 — Progetti e vista lista

- [ ] **T2.1** Schema Prisma: `Project`, `Task` (enum `TaskType`, `status`, `sortKey`, `version`), `Dependency` (enum `DependencyType`) + migrazione.
- [ ] **T2.2** `packages/shared`: utility date di calendario (`parseDate`, `addDays`, `diffDays`, `isWeekend`, `addWorkingDays`, `workingDaysBetween`) con test esaustivi (cambi mese/anno, bisestili).
- [ ] **T2.3** `packages/shared`: utility fractional indexing per `sortKey` (generazione tra due chiavi, in testa, in coda) con test.
- [ ] **T2.4** Schemi zod per progetto e task (create, update con `version`, output).
- [ ] **T2.5** Guard `requireProjectRole(projectId, minRole)` + API progetti: `GET /workspaces/:id/projects`, `POST /workspaces/:id/projects`, `PATCH /projects/:id`, archiviazione. Test autorizzazione (non membro, VIEWER).
- [ ] **T2.6** API `GET /projects/:id`: progetto + tutti i task + dipendenze in una risposta.
- [ ] **T2.7** API task: `POST /projects/:id/tasks`, `PATCH /tasks/:id` (con controllo `version` → `409`), `DELETE /tasks/:id` (cascade su sottotask e dipendenze). Validazioni: `endDate ≥ startDate`, milestone a durata zero, parent nello stesso progetto.
- [ ] **T2.8** API `POST /tasks/:id/move`: cambio parent e/o `sortKey`, rifiuto se il nuovo parent è un discendente.
- [ ] **T2.9** Web: pagina progetto con query `project`, mutation con optimistic update e gestione `409`.
- [ ] **T2.10** Web: modello righe — da lista piatta di task ad albero → lista visibile appiattita con profondità, rispettando i rami collassati (modulo puro + test).
- [ ] **T2.11** Web: griglia virtualizzata (TanStack Virtual) con colonne nome, inizio, fine, durata, avanzamento, assegnatario; indentazione per livello; expand/collapse.
- [ ] **T2.12** Web: editing inline delle celle (testo, date picker, numero %, select assegnatario), con conferma su Invio / annulla su Esc.
- [ ] **T2.13** Web: aggiunta task/gruppo/milestone, eliminazione con conferma, indent/outdent (Tab / Shift+Tab).
- [ ] **T2.14** Web: riordino righe con drag (dnd-kit) → `move`.
- [ ] **T2.15** Web: CRUD progetti dalla sidebar (crea, rinomina, colore, archivia).
- [ ] **T2.16** Web: modalità sola lettura per VIEWER (controlli disabilitati; il server resta l'unico garante).

## Fase 3 — Timeline Gantt in sola lettura

- [ ] **T3.1** Spike SVAR React Gantt (mezza giornata, branch separato): verificare griglia ad albero, dipendenze, drag, personalizzazione, licenza. Decisione documentata in `docs/PLAN.md` §5.
- [ ] **T3.2** Modulo puro scala temporale: data ↔ x per livello di zoom (giorno/settimana/mese/trimestre), range visibile, test.
- [ ] **T3.3** Header temporale a due livelli (es. mese / giorni) coerente con lo zoom.
- [ ] **T3.4** Layout split: griglia a sinistra, timeline a destra, divisore ridimensionabile, scroll verticale sincronizzato sulla stessa lista virtualizzata.
- [ ] **T3.5** Rendering SVG di barre task (con avanzamento), barre gruppo, rombi milestone; colori; virtualizzazione orizzontale.
- [ ] **T3.6** Sfondo: weekend evidenziati, linea "oggi", griglia di colonne.
- [ ] **T3.7** Controlli zoom, "vai a oggi", scroll automatico a un task selezionato.
- [ ] **T3.8** Fixture/seed con 2.000 task e misura delle prestazioni di scroll; correzioni se sotto i 60 fps percepiti.

## Fase 4 — Motore di scheduling (TDD)

- [ ] **T4.1** ⚠️ Confermare con l'utente le assunzioni 1 e 2 di PLAN §7 (push-only, calendario) prima di iniziare.
- [ ] **T4.2** Grafo delle dipendenze: costruzione, ordinamento topologico, rilevamento cicli (con test).
- [ ] **T4.3** Vincoli FS/SS/FF/SF con lag positivo e negativo in giorni lavorativi: calcolo della prima data ammessa per un successore.
- [ ] **T4.4** Propagazione: dato un insieme di task modificati, calcola l'insieme minimo di task da spostare (push-only), preservando le durate.
- [ ] **T4.5** Rollup: date dei gruppi derivate dai figli, ricalcolate dopo ogni propagazione; avanzamento dei gruppi pesato per durata.
- [ ] **T4.6** Schemi zod e API dipendenze: `POST /projects/:id/dependencies` (rifiuta cicli e duplicati), `DELETE /dependencies/:id`.
- [ ] **T4.7** API `POST /projects/:id/schedule`: applica le modifiche in transazione usando il motore, restituisce tutti i task cambiati; controllo `version`.
- [ ] **T4.8** `PATCH /tasks/:id` sulle date passa dal motore (nessun percorso che salti la ripianificazione).

## Fase 5 — Interazioni sulla timeline

- [ ] **T5.1** Modulo puro di drag: hit-testing (corpo, bordo sinistro, bordo destro, maniglia avanzamento, punto di connessione), snap al giorno, test.
- [ ] **T5.2** Drag per spostare una barra con anteprima live (motore lato client applicato ai successori).
- [ ] **T5.3** Ridimensionamento inizio/fine e trascinamento dell'avanzamento.
- [ ] **T5.4** Commit del drag su `/schedule` con optimistic update, rollback su errore, gestione `409`.
- [ ] **T5.5** Rendering frecce delle dipendenze (percorsi ortogonali per i 4 tipi), evidenziazione su hover.
- [ ] **T5.6** Creazione dipendenza trascinando da un punto di connessione a un'altra barra; errore chiaro in caso di ciclo.
- [ ] **T5.7** Selezione ed eliminazione di una dipendenza; modifica di tipo e lag da popover.
- [ ] **T5.8** Creazione di un task trascinando su una riga vuota della timeline.
- [ ] **T5.9** Setup Playwright + E2E: login → crea progetto → crea due task collegati → sposta il predecessore → reload → successore ripianificato.

## Fase 6 — Collaborazione base

- [ ] **T6.1** API membri: `GET /workspaces/:id/members`, aggiunta per email di utente registrato ⚠️(assunzione 3), cambio ruolo, rimozione; impedire di rimuovere l'ultimo OWNER.
- [ ] **T6.2** Web: pagina impostazioni workspace con gestione membri (solo OWNER).
- [ ] **T6.3** Assegnatario limitato ai membri del workspace (validazione server); avatar/iniziali in griglia e sulle barre.
- [ ] **T6.4** Filtri per assegnatario e stato, ricerca per nome; i task filtrati mantengono visibili gli antenati.
- [ ] **T6.5** Pannello dettaglio task (descrizione, stato, colore, dipendenze entranti/uscenti).
- [ ] **T6.6** Test di autorizzazione per ogni ruolo su tutti gli endpoint mutanti (matrice completa).

## Fase 7 — Hardening

- [ ] **T7.1** Scorciatoie tastiera (nuovo task, elimina, indent/outdent, navigazione celle, zoom) e relativa legenda.
- [ ] **T7.2** Stati vuoti, loading e messaggi di errore coerenti in tutta l'app.
- [ ] **T7.3** Accessibilità base: navigazione da tastiera nella griglia, focus visibile, contrasto, label sui controlli.
- [ ] **T7.4** Revisione sicurezza: header HTTP (helmet), CORS, scadenza e rotazione sessioni, audit dipendenze npm.
- [ ] **T7.5** Ripetere la misura prestazioni con 2.000 task e dipendenze; ottimizzare il rendering delle frecce se necessario.
- [ ] **T7.6** ⚠️ Decidere il target di deploy (assunzione 5) e preparare Dockerfile/configurazione di conseguenza.
