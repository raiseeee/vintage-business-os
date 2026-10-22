# Vintage Business OS

Gestionale per compravendita di abbigliamento vintage e streetwear: fornitori verificabili, lotti, capi, vendite e margini reali.

**Stato: Milestone 1 completata** (layout, navigazione, dashboard, logica margini testata). Nessun database collegato: la dashboard mostra zeri, non dati inventati.

## Requisiti
- Node.js 20.19+ (testato con 22) e npm

## Avvio locale
```bash
npm install
npm run dev        # http://localhost:3000
```

## Verifiche
```bash
npm test           # Vitest: logica margini e anti doppio conteggio
npm run typecheck
npm run lint
npm run build
```

## Struttura
```
src/app/(app)/     pagine con sidebar (dashboard, fornitori, crm, lotti, capi, roadmap)
src/components/    Sidebar, intestazioni e segnaposto
src/lib/metrics.ts calcoli in centesimi: costi lotto, profitto capo, dashboard
```

## Regole di calcolo
- Costi di acquisto, spedizione in entrata e altri costi stanno **solo sul lotto**.
- Commissioni, spedizione in uscita ed extra stanno **solo sulla vendita del capo**.
- Costo per capo = costo totale lotto / quantità dichiarata.
- Capi resi: esclusi da ricavi e valore stock finché non rivalutati.

## Milestone
1. Progetto avviabile, layout, dashboard (fatto)
2. Supabase: migrazioni SQL, RLS per utente, autenticazione
3. Supplier Finder: anagrafica, fonti, punteggio trasparente
4. Lotti e capi: inventario, vendite, profitti, CSV
5. CRM fornitori

## Roadmap futura (non implementata)
Casella email, email dei fornitori in app, invii multipli con controlli anti-spam, ricerche pianificate e notifiche, API di ricerca web, sito pubblico/multiutenza/abbonamenti.

## Deployment
Previsto su Vercel dopo la Milestone 2 (servono le variabili Supabase in `.env.example`).
