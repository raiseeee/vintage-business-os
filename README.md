# ARCHVNT

Gestionale per compravendita di abbigliamento vintage e streetwear: lotti, capi, vendite e margini reali.

**Stato: MVP completo** (lotti, capi, vendite, statistiche per lotto, inventario, attività condivisa).

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
   4. `20261022000004_demo_data.sql` (i dati demo sono poi rimossi dalla 11)
   5. `20261022000005_sales_functions.sql`
   6. `20261023000001_search.sql` (tabelle poi rimosse dalla migrazione 11: applicala comunque per tenere l'ordine)
   7. `20261025000001_shared_business.sql` — **attività condivisa** (più account sugli stessi dati). Su un database con dati già inseriti **non applicarla prima di aver letto la sezione «Attività condivisa e collaboratori»**.
   8. `20261026000001_inventory.sql` — **inventario** (materiali per capo e attrezzature). Si applica dopo la 7, con un normale copia-e-incolla nello SQL Editor; rollback in `supabase/rollback/20261026000001_inventory_down.sql`.
   9. `20261027000001_inventory_stock.sql` — **giacenza dei materiali** (quanti ne restano, es. 99/100). Si applica dopo la 8; rollback in `supabase/rollback/20261027000001_inventory_stock_down.sql`.
   10. `20261028000001_item_listing.sql` — dove/quando un capo è stato pubblicato (canale). Si applica dopo la 9; rollback in `supabase/rollback/20261028000001_item_listing_down.sql`. Senza questa migrazione il flusso funziona lo stesso, ma il canale non viene ricordato.
   11. `20261029000001_remove_suppliers.sql` — **elimina Supplier, CRM fornitori, ricerche e dati demo dal database. IRREVERSIBILE.** Il nome del fornitore resta solo come testo facoltativo sul lotto (copiato dai fornitori esistenti). Procedura: **(1)** fai il backup (Dashboard → *Backup completo (JSON)* e `pg_dump`); **(2)** `git pull`; **(3)** applicala subito dopo il pull (tra il pull e la migrazione la creazione di un lotto dà errore); **(4)** se i conteggi di lotti, capi o vendite non tornano, la migrazione si annulla da sola. Non esiste un rollback: per tornare indietro si ripristina il backup. Le vecchie procedure di rollback (es. `shared_business_down`) non valgono più dopo questa migrazione.
   12. `20261030000001_suppliers_simple.sql` — **Fornitori** (nome, email, telefono, indirizzo, note e storico lotti). Si applica **dopo la 11**; i nomi già scritti sui lotti diventano fornitori. Rilanciabile senza danni; rollback in `supabase/rollback/20261030000001_suppliers_simple_down.sql`. Prima di applicarla la pagina Fornitori mostra solo un avviso.

   Se avevi già applicato le prime quattro, **applica solo la quinta** (serve per registrare le vendite).

   In alternativa, con la [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link` e `supabase db push`.
3. **Disattiva le registrazioni pubbliche**: *Authentication → Sign In / Providers* → disattiva *Allow new users to sign up*. L'app non ha una pagina di registrazione: gli account li crei tu da Supabase. (Anche se qualcuno si registrasse, senza un invito non vede nessun dato.)
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
`npm run test:db` crea un cluster Postgres temporaneo, simula le parti di Supabase (ruoli, `auth.uid()`, storage) e verifica oltre 160 casi, in tre fasi (modello a utente singolo → migrazione sui dati esistenti → attività condivisa e rollback): isolamento tra utenti, vincoli sui dati, storage, registrazione e annullamento delle vendite, rimozione dei fornitori. Non sostituisce una prova sul progetto Supabase reale (vedi sotto).

## Attività condivisa e collaboratori

Più account lavorano sugli stessi dati (lotti, capi, foto, vendite, statistiche, esportazioni).

**Ruoli**
- **Titolare (owner)**: tutti i poteri, compresi eliminare, annullare vendite, invitare, rimuovere collaboratori, promuovere. Voi 3 soci siete tutti titolari.
- **Collaboratore (collaborator)**: vede tutto, crea e modifica (capi, foto, vendite, resi…). **Non elimina** nulla, non annulla vendite, non gestisce le persone.
- I permessi li applica il database (RLS + funzioni), non solo l'interfaccia. L'attività non resta mai senza titolare; nessuno può promuovere se stesso.

**Creare account dall'app (facoltativo)**: nella pagina Collaboratori, «Crea un account» crea email + password direttamente, senza Supabase. Richiede la chiave **service_role** come variabile segreta del server: su Vercel → *Settings → Environment Variables* → `SUPABASE_SERVICE_ROLE_KEY` (in locale `.env.local`). Mai nel repository né con prefisso `NEXT_PUBLIC_`; con quella chiave il server aggira le policy, quindi l'app la usa solo dopo aver verificato che chi chiama sia titolare. Senza la chiave l'app funziona e questa funzione mostra un avviso. Usa una chiave nuova (quella vecchia incollata in chat va ruotata).

**Come aggiungere una persona (con un account già esistente)**
1. Crea il suo account: Supabase → *Authentication → Users → Add user* (email + password, *Auto Confirm User*). Così scegli tu la password.
2. Nell'app, pagina **Collaboratori** (visibile ai titolari) → inserisci la sua email, il ruolo e la scadenza → *Crea invito*.
3. Copia il link mostrato (si vede **una sola volta**: nel database resta solo l'impronta) e mandaglielo.
4. La persona apre il link, accede con **quella** email e preme *Accetta*. Un invito vale una volta, scade, è revocabile e non funziona con un'altra email.
Nessun servizio esterno e nessun costo: le email non vengono inviate dall'app.

### Applicare la migrazione ai dati esistenti (in sicurezza)
La migrazione assegna tutti i dati attuali all'attività «ARCHVNT», con te come titolare, senza perdere né duplicare righe. Se qualcosa non torna (dati di più utenti, conteggi diversi) **si interrompe senza cambiare niente** (è un'unica transazione).

1. **Backup.** Il piano gratuito di Supabase non ha backup automatici:
   - dalla Dashboard, pulsante **Backup completo (JSON)** (archivio dei dati);
   - consigliato, copia completa del database: `pg_dump "<connection string di Supabase>" -Fc -f backup.dump` (stringa in *Project Settings → Database → Connection string*; con la password del database). Conserva i file fuori dal progetto. Le foto stanno nello Storage e non sono nel dump: restano dove sono, la migrazione non le sposta né le tocca.
2. **Aggiorna il codice** (`git pull`) — l'app nuova funziona anche *prima* della migrazione (si comporta come prima).
3. Incolla `20261025000001_shared_business.sql` nello *SQL Editor* ed eseguila. Se dà errore, non è stato cambiato nulla: leggi il messaggio.
4. Riapri l'app: dovrebbe comparire **Collaboratori** nel menu. Controlla che lotti, capi, foto e vendite siano tutti presenti.
5. Le foto già caricate restano nel vecchio percorso e continuano a vedersi; quelle nuove vanno nel percorso dell'attività.

**Rollback**: `supabase/rollback/20261025000001_shared_business_down.sql` (a mano, solo se serve). Riporta al modello a un utente assegnando tutto al primo titolare; le foto caricate col nuovo percorso non sarebbero più raggiungibili, quindi va usato prima di averne caricate di nuove (o dopo averle spostate).

### Cosa è verificato e cosa no
- **Verificato in locale** (`npm run test:db`): migrazione sui dati esistenti (conteggi e collegamenti intatti), RLS di titolare/collaboratore/esterno, nessuna auto-promozione, ultimo titolare protetto, inviti (scaduto, revocato, riusato, email sbagliata, già membro), due attività isolate, policy dello Storage (simulato), vendite/annullamenti, eliminazione di un account che non cancella i dati, rollback su una copia.
- **Da provare su Supabase vero**: le policy dello Storage con il vero servizio (upload/download di una foto da un collaboratore e da un esterno), il claim `email` nel token (usato da `accept_invite`), il login di un secondo account reale, l'impostazione «registrazioni disattivate». Il test locale simula questi pezzi ma non li sostituisce.
- Chi non è membro non vede nulla anche se ha un account; la service role key non è usata e non va mai messa nell'app.

## Sicurezza
- Nessuna chiave segreta nel repository o nel frontend. La publishable key è pubblica per progetto; i dati sono protetti dalle policy RLS.
- Ogni tabella ha `user_id` e RLS attiva (anche `FORCE`); l'accesso anonimo è revocato.
- Le chiavi esterne sono composite `(user_id, id)`: non si possono collegare dati propri a righe di un altro utente.
- Le pagine dell'app sono protette due volte: `src/proxy.ts` e il controllo dell'utente in `src/app/(app)/layout.tsx`.
- Il bucket foto `item-photos` è privato; i file stanno in `<user_id>/<item_id>/<file>`.

## Lotti, capi e vendite (Milestone 4)
- **Lotti**: fornitore, data, costi (merce, spedizione in entrata, altri), quantità dichiarata, peso. Il costo di ogni capo è il costo totale del lotto diviso la quantità **dichiarata**, così registrare i capi a poco a poco non sposta il costo unitario.
- **Capi**: codice univoco, marca, categoria, taglia, condizione, stato, prezzo previsto, foto. Si possono creare 1 alla volta o tanti vuoti insieme (`L-001-001`, `-002`…) dalla scheda del lotto.
- **Stati**: da controllare, da fotografare, pronto, pubblicato, venduto, reso. «Venduto» si ottiene solo registrando una vendita; «reso» con il pulsante dedicato.
- **Vendita**: canale, data, prezzo incassato, commissioni, spedizione in uscita, costi extra. Registrare una vendita e cambiare lo stato del capo avviene in un'unica operazione del database. Un capo reso e poi rivenduto sostituisce la vecchia vendita.
- **Foto**: caricate dal browser direttamente nello storage privato (JPG, PNG, WebP, max 10 MB), poi registrate nel database. Si possono aggiungere già alla creazione del capo (campo «Foto» del modulo) o dopo dalla scheda. Se una foto fallisce, il capo resta creato e te lo dice.
- **Importazione CSV** (pulsante «Importa CSV» in Capi): scegli il lotto e un file con una riga per capo (colonne `marca, categoria, taglia, condizione, prezzo previsto, note`, tutte facoltative; c'è il modello da scaricare). L'app assegna i codici in ordine (`L-001-001`, `-002`…, dal numero successivo a quelli già nel lotto) e lo stato «da controllare»; le foto si aggiungono dopo dalla scheda. Tutto o niente: se una riga è sbagliata non entra nulla e ti dice quale riga. Massimo 500 capi, file fino a circa 900 KB.
- **Profitto** per capo (ricavo netto − costo attribuito), per lotto; dashboard con capitale investito, valore stock, vendite, costi, margine realizzato e saldo di cassa.
- **Esportazione CSV** di capi, lotti e vendite (pulsanti in dashboard e nelle liste). Formato per Excel italiano: separatore `;`, importi con la virgola, accenti corretti; i testi che sembrano formule sono neutralizzati.
- Le liste leggono i dati a pagine fino in fondo, quindi i totali non si fermano a 1000 righe.

## Capi: lotto, stati e passaggi automatici

- **Capi** parte dalla scelta del lotto (con il riepilogo degli stati dei suoi capi); scelto il lotto vedi i suoi capi. «Vedi tutti i capi insieme» per cercare senza conoscere il lotto.
- **Senza foto** un capo non può essere «Pronto per la vendita» né «Pubblicato»: se lo imposti, resta **«Da fotografare»** (te lo dice).
- **Con la prima foto** un capo «Da controllare» o «Da fotografare» passa da solo a **«Pronto per la vendita»**.
- **Pronto per la vendita → pulsante «Pubblica»**: si apre una finestra che chiede *dove* l'hai messo in vendita; il capo diventa «Pubblicato» e il canale resta registrato.
- **Pubblicato → pulsante «Segna venduto»**: la finestra chiede il prezzo di vendita (canale e data già compilati; commissioni e spedizione facoltative); il capo diventa «Venduto» con la sua vendita.
- I pulsanti sono nella lista dei capi e nella scheda del capo. Collaboratori e titolari li usano allo stesso modo (nessuna eliminazione coinvolta).

## Inventario e calcolatore

Pagina **Inventario**: le spese fisse dell'attività, senza l'affitto.
- **Materiali di consumo** (sacchetti, scatole…): inserisci costo totale e quantità; il costo unitario è calcolato (100 sacchetti a 10 € → 0,10 €). Indichi quanti ne usa un capo (anche 0,5). Quelli «in uso» formano il **costo materiali per capo**.
- Quel costo viene **congelato su ogni vendita** al momento della registrazione (`sales.materials_cost_cents`): cambiare dopo i prezzi non modifica i profitti già registrati. Le vendite fatte prima di compilare l'inventario restano senza materiali. Quando finisci una confezione e ne compri un'altra, spegni la vecchia («Smetti di contare») per non contarle due volte.
- **Attrezzature** (stampante etichette…): non entrano nel costo dei capi. Compaiono nelle Statistiche come investimento e come «Risultato dopo gli investimenti» (profitto − investimenti). Nessun ammortamento.
- **Lavaggio e costi di un lotto** restano negli «altri costi» del lotto, non vanno in inventario (si conterebbero due volte).
- **Giacenza**: la colonna «Rimaste» mostra pezzi rimasti/acquistati (es. 99/100). Ogni vendita consuma i pezzi dei materiali «in uso»; annullare una vendita li restituisce. Le vendite registrate prima della migrazione 9 non hanno consumi, quindi la giacenza parte piena. «Conta nel costo dei capi?» si cambia da Modifica.
- Tutti i membri aggiungono e modificano; eliminare solo i titolari.
- **Calcolatore**: scegli un lotto e si compilano costo per capo (già con spedizione in entrata e altri costi del lotto), materiali dall'inventario e prezzo medio previsto dei capi. Link «Calcola la redditività» nella scheda del lotto.
- L'app funziona anche prima della migrazione: l'Inventario mostra come applicarla e i profitti restano come prima.

## Calcolatore e statistiche
- **Calcolatore** (menu «Calcolatore», e link «Calcola il profitto» nella scheda di un capo non venduto): inserisci costi, prezzo di vendita previsto, sconto, commissione (% e fissa) e spedizione a tuo carico. Ottieni ricavo netto, profitto, margine (sul prezzo incassato), ROI (sui costi) e il **prezzo minimo per non andare in perdita**. Le formule sono scritte nella pagina e nei test (`src/lib/profit.ts`). Le commissioni non sono precompilate: le imposti tu e si ricordano nel browser.
- **Statistiche** (menu «Statistiche»): margine, profitto medio, venduti su registrati e giorni medi per marca, categoria, lotto o canale, **solo dalle tue vendite registrate**. Sotto 5 vendite compare «pochi dati». I giorni vanno dall'acquisto del lotto alla vendita (non esiste una data di pubblicazione). Nessuna previsione di mercato: senza una fonte di dati lecita su Vinted non sarebbe affidabile.

**Margine realizzato** = vendite − costi di vendita − costo dei soli capi venduti. **Saldo di cassa** = incassi netti − costo dell'intero capitale investito: resta negativo finché non hai recuperato quanto speso.

## Struttura
```
src/app/(app)/        pagine protette con sidebar
src/app/login/        login (server action con validazione zod)
src/proxy.ts          protezione delle rotte e rinnovo sessione
src/lib/supabase/     client server e gestione sessione
src/lib/env.ts        validazione configurazione
src/lib/metrics.ts    calcoli in centesimi: costi lotto, profitto capo, dashboard
src/lib/business/     lotti, capi, vendite: validazione, query paginate, esportazione CSV
src/lib/csv.ts        generatore CSV sicuro per Excel
src/components/       form (client), elementi UI condivisi
supabase/migrations/  schema, RLS, storage, vendite, attività condivisa, inventario
supabase/tests/       harness e test SQL
scripts/test-db.sh    esegue migrazioni e test SQL in locale
```

## Regole di calcolo
- Costi di acquisto, spedizione in entrata e altri costi stanno **solo sul lotto**.
- Commissioni, spedizione in uscita ed extra stanno **solo sulla vendita del capo**.
- Costo per capo = costo totale lotto / quantità dichiarata.
- Capi resi: esclusi da ricavi e valore stock finché non rivalutati.

## Milestone
1. Progetto avviabile, layout, dashboard (fatto)
2. Supabase: migrazioni SQL, RLS per utente, autenticazione (fatto)
3. Lotti e capi: inventario, vendite, profitti, CSV, dashboard collegata (fatto)

## Roadmap futura (non implementata)
Collegamento ai siti di vendita (Vinted, Depop, eBay) per preparare gli annunci dai capi pronti (da verificare cosa permette ogni sito), casella email, sito pubblico/multiutenza/abbonamenti.

## Deployment
Previsto su Vercel: importa il repository e imposta le due variabili di `.env.example` in *Project Settings → Environment Variables*. Le istruzioni verificate arrivano a fine MVP.

## Regole di design

Le regole sono verificate da `src/design-rules.test.ts` (parte di `npm test`):

1. Spaziature solo multipli di 8 px (scala Tailwind pari).
2. Una sola palette neutra (`stone`), niente gradienti, ombre o glow.
3. Icone a linea, tutte da `lucide-react`; niente emoji.
4. Due soli pesi (400 e 600), niente maiuscolo.
5. Numeri senza decorazioni, con confronto rispetto al mese precedente.
6. Grafici con linee sottili, colori tenui e assi leggibili (`LineChart`).

Dopo un pull esegui `npm install` (nuova dipendenza `lucide-react`).
