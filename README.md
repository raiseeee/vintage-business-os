# Vintage Business OS

Gestionale per compravendita di abbigliamento vintage e streetwear: fornitori verificabili, lotti, capi, vendite e margini reali.

**Stato: Milestone 5 completata** (CRM fornitori). Tutte le milestone dell'MVP sono fatte; restano le funzioni future.

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
   5. `20261022000005_sales_functions.sql`
   6. `20261023000001_search.sql` (tabelle della ricerca rimossa: non usate, applicala comunque per tenere allineato lo schema)

   Se avevi già applicato le prime quattro, **applica solo la quinta** (serve per registrare le vendite).

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
npm test           # Vitest: margini, importi, validazione, punteggio, CSV, paginazione, form
npm run test:db    # migrazioni + RLS su un Postgres locale temporaneo
npm run typecheck
npm run lint
npm run build
```
`npm run test:db` crea un cluster Postgres temporaneo, simula le parti di Supabase (ruoli, `auth.uid()`, storage) e verifica 53 casi: isolamento tra utenti, regola del fornitore "diretto", vincoli sui dati, storage, registrazione e annullamento delle vendite, dati demo. Non sostituisce una prova sul progetto Supabase reale (vedi sotto).

## Sicurezza
- Nessuna chiave segreta nel repository o nel frontend. La publishable key è pubblica per progetto; i dati sono protetti dalle policy RLS.
- Ogni tabella ha `user_id` e RLS attiva (anche `FORCE`); l'accesso anonimo è revocato.
- Le chiavi esterne sono composite `(user_id, id)`: non si possono collegare dati propri a righe di un altro utente.
- Le pagine dell'app sono protette due volte: `src/proxy.ts` e il controllo dell'utente in `src/app/(app)/layout.tsx`.
- Il bucket foto `item-photos` è privato; i file stanno in `<user_id>/<item_id>/<file>`.

## Dati demo
Le funzioni SQL `load_demo_data()` e `clear_demo_data()` caricano/rimuovono dati di esempio marcati `[DEMO]` / `DEMO-…`, con domini `example.com` e nessuna azienda o marca reale. Comprendono 2 fornitori, il lotto `DEMO-L1` con 4 capi e una vendita. Si caricano e si rimuovono dal pulsante in fondo alla pagina *Supplier Finder*; i dati reali non vengono toccati.

## Supplier Finder (Milestone 3)
- Lista con filtri per nome, paese, lingua, tipologia di stock, marchio e tipo di fornitore.
- Scheda con: dati e contatti, ordine minimo e prezzi, **informazioni raggruppate per livello di prova** (documentato / dichiarato / ipotesi), fonti, storico valutazioni.
- **Punteggio 0-100**, mostrato criterio per criterio: vicinanza alla fonte 30%, trasparenza 25%, ordine minimo 15%, budget 15%, interesse vintage 15%. Il voto di vicinanza ha un tetto per tipo di fornitore (es. origine non verificata: max 2/5), così non si gonfia senza prove. I pesi sono in `src/lib/suppliers/score.ts`.
- **Ricerca fornitori**: fuori dall'app (vedi sotto); nessun risultato simulato.
- Non ancora disponibile: eliminare un fornitore dall'interfaccia.

## Ricerca fornitori
L'app **non cerca fornitori**: i fornitori si trovano fuori (a mano o chiedendo a Claude in chat) e qui si registrano, con le loro fonti, quelli che hai scelto. Una pagina di ricerca web con salvataggio dei risultati è stata provata e poi rimossa (era nel commit `2fae166`, recuperabile da git). La migrazione `20261023000001_search.sql` resta per non rompere la cronologia: le tabelle `search_runs` e `search_results` non sono più usate dall'app.

## CRM fornitori (Milestone 5)
- Pagina **CRM**: prossime azioni ordinate per scadenza (le scadute in rosso) e pipeline per stato (da contattare → contattata → in attesa → risposta ricevuta → campione richiesto → verificata / scartata), con data dell'ultimo contatto.
- Nella scheda di ogni fornitore, sezione **CRM**: cambi stato, scrivi la prossima azione con data, registri i contatti (canale, data, riassunto) e vedi lo storico.
- Nessuna migrazione nuova: usa tabelle e policy già presenti. Non invia email: i contatti si registrano a mano.

## Lotti, capi e vendite (Milestone 4)
- **Lotti**: fornitore, data, costi (merce, spedizione in entrata, altri), quantità dichiarata, peso. Il costo di ogni capo è il costo totale del lotto diviso la quantità **dichiarata**, così registrare i capi a poco a poco non sposta il costo unitario.
- **Capi**: codice univoco, marca, categoria, taglia, condizione, stato, prezzo previsto, foto. Si possono creare 1 alla volta o tanti vuoti insieme (`L-001-001`, `-002`…) dalla scheda del lotto.
- **Stati**: da controllare, da fotografare, pronto, pubblicato, venduto, reso. «Venduto» si ottiene solo registrando una vendita; «reso» con il pulsante dedicato.
- **Vendita**: canale, data, prezzo incassato, commissioni, spedizione in uscita, costi extra. Registrare una vendita e cambiare lo stato del capo avviene in un'unica operazione del database. Un capo reso e poi rivenduto sostituisce la vecchia vendita.
- **Foto**: caricate dal browser direttamente nello storage privato (JPG, PNG, WebP, max 10 MB), poi registrate nel database.
- **Profitto** per capo (ricavo netto − costo attribuito), per lotto e per fornitore; dashboard con capitale investito, valore stock, vendite, costi, margine realizzato e saldo di cassa.
- **Esportazione CSV** di capi, lotti e vendite (pulsanti in dashboard e nelle liste). Formato per Excel italiano: separatore `;`, importi con la virgola, accenti corretti; i testi che sembrano formule sono neutralizzati.
- Le liste leggono i dati a pagine fino in fondo, quindi i totali non si fermano a 1000 righe.

**Margine realizzato** = vendite − costi di vendita − costo dei soli capi venduti. **Saldo di cassa** = incassi netti − costo dell'intero capitale investito: resta negativo finché non hai recuperato quanto speso.

## Struttura
```
src/app/(app)/        pagine protette con sidebar
src/app/login/        login (server action con validazione zod)
src/proxy.ts          protezione delle rotte e rinnovo sessione
src/lib/supabase/     client server e gestione sessione
src/lib/env.ts        validazione configurazione
src/lib/metrics.ts    calcoli in centesimi: costi lotto, profitto capo, dashboard
src/lib/suppliers/    costanti, validazione zod, punteggio, query
src/lib/business/     lotti, capi, vendite: validazione, query paginate, esportazione CSV
src/lib/csv.ts        generatore CSV sicuro per Excel
src/lib/search/       interfaccia per la futura ricerca web
src/components/       form (client), elementi UI condivisi
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
3. Supplier Finder: anagrafica, fonti, punteggio trasparente, dati demo (fatto)
4. Lotti e capi: inventario, vendite, profitti, CSV, dashboard collegata (fatto)
5. CRM fornitori: stati, storico contatti, prossime azioni (fatto)

## Da fare / promemoria
- **Ricerca fornitori e fonti**: l'app non cerca da sola. Prima di comprare servono fornitori veri con fonti verificabili (provenienza, registro imprese, autorizzazioni). Si può fare a mano o chiedendo a Claude di cercarli e riassumere cosa è documentato e cosa solo dichiarato.
- Allegare file (documenti, screenshot) alle fonti dei fornitori.
- Eliminare un fornitore dall'interfaccia (oggi si rimuovono solo i dati demo).

## Roadmap futura (non implementata)
Casella email, email dei fornitori in app, invii multipli con controlli anti-spam, ricerche pianificate e notifiche, API di ricerca web, sito pubblico/multiutenza/abbonamenti.

## Deployment
Previsto su Vercel: importa il repository e imposta le due variabili di `.env.example` in *Project Settings → Environment Variables*. Le istruzioni verificate arrivano a fine MVP.
