# Vintage Business OS

Gestionale per compravendita di abbigliamento vintage e streetwear: fornitori verificabili, lotti, capi, vendite e margini reali.

**Stato: Milestone 2 completata** (schema SQL, RLS, autenticazione). L'interfaccia dei moduli (fornitori, lotti, capi, CRM) arriva nelle milestone successive; la dashboard mostra ancora zeri perché non è ancora collegata al database.

## Requisiti
- Node.js 20.19+ (testato con 22) e npm
- Un progetto Supabase (piano gratuito sufficiente)
- Per i test del database: Postgres 14+ installato localmente (non serve per usare l'app)

## 1. Configurare Supabase
1. Crea un progetto su https://supabase.com.
2. **Applica le migrazioni, in ordine**, da *SQL Editor* incollando il contenuto di ogni file in `supabase/migrations/`:
   1. `20261022000001_schema.sql`
   2. `20261022000002_rls.sql`
   3. `20261022000003_storage.sql`
   4. `20261022000004_demo_data.sql`

   In alternativa, con la [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link` e `supabase db push`.
3. **Disattiva le registrazioni pubbliche**: *Authentication → Sign In / Providers* → disattiva *Allow new users to sign up*. L'app è per una sola persona e non ha una pagina di registrazione.
4. **Crea il tuo utente**: *Authentication → Users → Add user* (email + password, con "Auto Confirm User").
5. Copia l'URL e la publishable key (o anon key) da *Project Settings → API*.

> Applica le migrazioni (in particolare la RLS) **prima** di inserire dati reali.

## 2. Avvio locale
```bash
npm install
cp .env.example .env.local     # poi compila i due valori Supabase
npm run dev                    # http://localhost:3000
```
Senza `.env.local` l'app mostra la pagina di login con le istruzioni di configurazione.

## Verifiche
```bash
npm test           # Vitest: margini e validazione configurazione
npm run test:db    # migrazioni + RLS su un Postgres locale temporaneo
npm run typecheck
npm run lint
npm run build
```
`npm run test:db` crea un cluster Postgres temporaneo, simula le parti di Supabase (ruoli, `auth.uid()`, storage) e verifica 40 casi: isolamento tra utenti, regola del fornitore "diretto", vincoli sui dati, storage e dati demo. Non sostituisce una prova sul progetto Supabase reale (vedi sotto).

## Sicurezza
- Nessuna chiave segreta nel repository o nel frontend. La publishable key è pubblica per progetto; i dati sono protetti dalle policy RLS.
- Ogni tabella ha `user_id` e RLS attiva (anche `FORCE`); l'accesso anonimo è revocato.
- Le chiavi esterne sono composite `(user_id, id)`: non si possono collegare dati propri a righe di un altro utente.
- Le pagine dell'app sono protette due volte: `src/proxy.ts` e il controllo dell'utente in `src/app/(app)/layout.tsx`.
- Il bucket foto `item-photos` è privato; i file stanno in `<user_id>/<item_id>/<file>`.

## Dati demo
Le funzioni SQL `load_demo_data()` e `clear_demo_data()` caricano/rimuovono dati di esempio marcati `[DEMO]` / `DEMO-…`, con domini `example.com` e nessuna azienda o marca reale. **Non sono ancora richiamabili dall'interfaccia**: il pulsante arriva con la Milestone 3.

## Struttura
```
src/app/(app)/        pagine protette con sidebar
src/app/login/        login (server action con validazione zod)
src/proxy.ts          protezione delle rotte e rinnovo sessione
src/lib/supabase/     client server e gestione sessione
src/lib/env.ts        validazione configurazione
src/lib/metrics.ts    calcoli in centesimi: costi lotto, profitto capo, dashboard
supabase/migrations/  schema, RLS, storage, dati demo
supabase/tests/       harness e test SQL
scripts/test-db.sh    esegue migrazioni e test SQL in locale
```

## Regole di calcolo
- Costi di acquisto, spedizione in entrata e altri costi stanno **solo sul lotto**.
- Commissioni, spedizione in uscita ed extra stanno **solo sulla vendita del capo**.
- Costo per capo = costo totale lotto / quantità dichiarata.
- Capi resi: esclusi da ricavi e valore stock finché non rivalutati.

## Regole sui fornitori
- Un fornitore può essere "raccoglitore diretto" o "grossista documentato" solo con almeno un'informazione di **provenienza documentata**, cioè collegata a una fonte registrata. Lo impone il database, non solo l'interfaccia.
- Ogni informazione ha un livello di prova: `documentato`, `dichiarato`, `ipotesi`.
- Il punteggio è l'ultima valutazione (5 criteri, 0-5); i pesi vivranno nel codice.

## Milestone
1. Progetto avviabile, layout, dashboard (fatto)
2. Supabase: migrazioni SQL, RLS per utente, autenticazione (fatto)
3. Supplier Finder: anagrafica, fonti, punteggio trasparente, pulsante dati demo
4. Lotti e capi: inventario, vendite, profitti, CSV, dashboard collegata
5. CRM fornitori

## Roadmap futura (non implementata)
Casella email, email dei fornitori in app, invii multipli con controlli anti-spam, ricerche pianificate e notifiche, API di ricerca web, sito pubblico/multiutenza/abbonamenti.

## Deployment
Previsto su Vercel: importa il repository e imposta le due variabili di `.env.example` in *Project Settings → Environment Variables*. Le istruzioni verificate arrivano a fine MVP.
