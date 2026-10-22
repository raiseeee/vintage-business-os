\set ON_ERROR_STOP on
\set uid_a '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set uid_b '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''

-- Due utenti di prova.
insert into auth.users (id) values (:uid_a), (:uid_b);

-- =====================================================================
-- Isolamento tra utenti
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);

insert into public.suppliers (name) values ('Fornitore di A');
select test.expect_equal((select count(*) from public.suppliers), 1, 'A vede il proprio fornitore');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_b, true);

select test.expect_equal((select count(*) from public.suppliers), 0, 'B non vede i fornitori di A');

with u as (update public.suppliers set name = 'hack' returning 1)
select test.expect_equal((select count(*) from u), 0, 'B non può modificare i fornitori di A');

with d as (delete from public.suppliers returning 1)
select test.expect_equal((select count(*) from d), 0, 'B non può cancellare i fornitori di A');

select test.expect_error(
  format('insert into public.suppliers (user_id, name) values (%L, %L)', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finto'),
  '42501', 'B non può inserire righe a nome di A');

select test.expect_error(
  $q$insert into public.purchase_lots (supplier_id, code, purchase_cost_cents, quantity)
     select id, 'X', 100, 1 from (select (select id from public.suppliers limit 1) as id) s$q$,
  '23502', 'B non trova fornitori di A da collegare');
commit;

-- Anche conoscendo l'id del fornitore di A, B non può agganciarci dati propri
-- (chiave esterna composita). Questo test gira da superutente per ottenere l'id.
select set_config('test.sup_a', (select id::text from public.suppliers where user_id = :uid_a::uuid), false);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_b, true);
select test.expect_error(
  format('insert into public.purchase_lots (supplier_id, code, purchase_cost_cents, quantity) values (%L, %L, 100, 1)',
         current_setting('test.sup_a'), 'LOTTO-B'),
  '23503', 'B non può collegare un lotto al fornitore di A');
select test.expect_error(
  format('insert into public.supplier_sources (supplier_id, title) values (%L, %L)',
         current_setting('test.sup_a'), 'fonte'),
  '23503', 'B non può aggiungere fonti al fornitore di A');
commit;

begin;
set local role anon;
select test.expect_error('select * from public.suppliers', '42501', 'utente anonimo: accesso negato');
commit;

-- =====================================================================
-- Regola del fornitore "diretto"
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);

select test.expect_error(
  $q$insert into public.suppliers (name, supplier_type) values ('X', 'raccoglitore_diretto')$q$,
  '23514', 'non si crea un fornitore diretto senza prove');

insert into public.suppliers (name) values ('Candidato diretto');
select set_config('test.cand', (select id::text from public.suppliers where name = 'Candidato diretto'), true);

select test.expect_error(
  format('update public.suppliers set supplier_type = %L where id = %L', 'raccoglitore_diretto', current_setting('test.cand')),
  '23514', 'non si passa a diretto senza prove');

insert into public.supplier_claims (supplier_id, field, statement, evidence_level)
values (current_setting('test.cand')::uuid, 'provenienza', 'lo dicono loro', 'dichiarato');

select test.expect_error(
  format('update public.suppliers set supplier_type = %L where id = %L', 'raccoglitore_diretto', current_setting('test.cand')),
  '23514', 'una provenienza solo dichiarata non basta');

select test.expect_error(
  format('insert into public.supplier_claims (supplier_id, field, statement, evidence_level) values (%L, %L, %L, %L)',
         current_setting('test.cand'), 'provenienza', 'senza fonte', 'documentato'),
  '23514', 'un''informazione documentata richiede una fonte');

insert into public.supplier_sources (supplier_id, title)
values (current_setting('test.cand')::uuid, 'Fonte reale di prova');

insert into public.supplier_claims (supplier_id, field, statement, evidence_level, source_id)
select current_setting('test.cand')::uuid, 'provenienza', 'documentata', 'documentato', id
from public.supplier_sources where supplier_id = current_setting('test.cand')::uuid;

update public.suppliers set supplier_type = 'raccoglitore_diretto' where id = current_setting('test.cand')::uuid;
select test.expect_equal(
  (select count(*) from public.suppliers where supplier_type = 'raccoglitore_diretto'), 1,
  'con prova documentata il tipo diretto è accettato');

select test.expect_error(
  format('delete from public.supplier_claims where supplier_id = %L and evidence_level = %L', current_setting('test.cand'), 'documentato'),
  '23514', 'non si rimuove l''ultima prova di un fornitore diretto');

select test.expect_error(
  format('update public.supplier_claims set evidence_level = %L, source_id = null where supplier_id = %L and evidence_level = %L',
         'ipotesi', current_setting('test.cand'), 'documentato'),
  '23514', 'non si declassa l''ultima prova di un fornitore diretto');

-- Una fonte di un altro fornitore non può sostenere questa informazione.
insert into public.suppliers (name) values ('Altro fornitore');
insert into public.supplier_sources (supplier_id, title)
select id, 'Fonte altrui' from public.suppliers where name = 'Altro fornitore';
select set_config('test.foreign_src', (select s.id::text from public.supplier_sources s where s.title = 'Fonte altrui'), true);
select test.expect_error(
  format('insert into public.supplier_claims (supplier_id, field, statement, evidence_level, source_id) values (%L, %L, %L, %L, %L)',
         current_setting('test.cand'), 'moq', 'x', 'documentato', current_setting('test.foreign_src')),
  '23503', 'la fonte deve appartenere allo stesso fornitore');
commit;

-- =====================================================================
-- Vincoli sui dati
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('test.sup', (select id::text from public.suppliers where name = 'Altro fornitore'), true);

select test.expect_error(
  format('insert into public.purchase_lots (supplier_id, code, purchase_cost_cents, quantity) values (%L, %L, -1, 1)', current_setting('test.sup'), 'NEG'),
  '23514', 'costo di acquisto negativo rifiutato');
select test.expect_error(
  format('insert into public.purchase_lots (supplier_id, code, purchase_cost_cents, quantity) values (%L, %L, 100, 0)', current_setting('test.sup'), 'QTY0'),
  '23514', 'quantità zero rifiutata');
select test.expect_error(
  format('insert into public.supplier_evaluations (supplier_id, proximity, transparency, min_order, budget_fit, vintage_interest) values (%L, 6, 1, 1, 1, 1)', current_setting('test.sup')),
  '23514', 'punteggio fuori scala 0-5 rifiutato');
select test.expect_error(
  format('insert into public.suppliers (name, country) values (%L, %L)', 'Paese errato', 'Italia'),
  '23514', 'paese non ISO rifiutato');

insert into public.purchase_lots (supplier_id, code, purchase_cost_cents, quantity)
values (current_setting('test.sup')::uuid, 'L-A', 10000, 5);
select test.expect_error(
  format('insert into public.purchase_lots (supplier_id, code, purchase_cost_cents, quantity) values (%L, %L, 1, 1)', current_setting('test.sup'), 'L-A'),
  '23505', 'codice lotto duplicato rifiutato');

insert into public.items (lot_id, code) select id, 'C-1' from public.purchase_lots where code = 'L-A';
insert into public.sales (item_id, channel, price_cents)
select id, 'canale', 1000 from public.items where code = 'C-1';
select test.expect_error(
  $q$insert into public.sales (item_id, channel, price_cents) select id, 'altro', 500 from public.items where code = 'C-1'$q$,
  '23505', 'una sola vendita per capo');
select test.expect_error(
  $q$delete from public.items where code = 'C-1'$q$,
  '23503', 'non si cancella un capo venduto');
select test.expect_error(
  $q$delete from public.purchase_lots where code = 'L-A'$q$,
  '23503', 'non si cancella un lotto con capi');
select test.expect_error(
  format('delete from public.suppliers where id = %L', current_setting('test.sup')),
  '23503', 'non si cancella un fornitore con acquisti');
commit;

-- =====================================================================
-- Storage delle foto
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
insert into storage.objects (bucket_id, name) values ('item-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/item/foto.jpg');
select test.expect_error(
  $q$insert into storage.objects (bucket_id, name) values ('item-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/item/foto.jpg')$q$,
  '42501', 'A non può scrivere nella cartella di B');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_b, true);
select test.expect_equal((select count(*) from storage.objects), 0, 'B non vede le foto di A');
commit;

-- =====================================================================
-- Dati demo
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_b, true);

select public.load_demo_data();
select test.expect_equal((select count(*) from public.suppliers where is_demo), 2, 'demo: 2 fornitori caricati per B');
select test.expect_equal((select count(*) from public.suppliers where is_demo and name not like '[DEMO]%'), 0, 'demo: tutti i fornitori sono marcati [DEMO]');
select test.expect_equal((select count(*) from public.items where is_demo and code not like 'DEMO-%'), 0, 'demo: tutti i capi hanno codice DEMO-');
select test.expect_error('select public.load_demo_data()', 'P0001', 'demo: caricamento doppio rifiutato');

-- Numeri attesi dalla dashboard: lotto 18000 / 10 capi = 1800 a capo;
-- vendita 4500 - (300+500+100) = 3600 netti; profitto 1800.
select test.expect_equal(
  (select (l.purchase_cost_cents + l.inbound_shipping_cents + l.other_costs_cents) / l.quantity
   from public.purchase_lots l where l.code = 'DEMO-L1'), 1800, 'demo: costo per capo = 1800');
select test.expect_equal(
  (select s.price_cents - s.fees_cents - s.outbound_shipping_cents - s.extra_costs_cents from public.sales s), 3600,
  'demo: ricavo netto = 3600');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select test.expect_equal((select count(*) from public.suppliers where is_demo), 0, 'A non vede i dati demo di B');
select public.load_demo_data();
select public.clear_demo_data();
select test.expect_equal((select count(*) from public.suppliers where is_demo), 0, 'clear_demo_data rimuove i fornitori demo di A');
select test.expect_equal((select count(*) from public.suppliers where not is_demo), 3, 'clear_demo_data lascia intatti i dati reali di A');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_b, true);
select test.expect_equal((select count(*) from public.suppliers where is_demo), 2, 'i dati demo di B non sono toccati dal clear di A');
select public.clear_demo_data();
select test.expect_equal((select count(*) from public.suppliers), 0, 'clear_demo_data rimuove tutto per B');
commit;

begin;
set local role anon;
select test.expect_error('select public.load_demo_data()', '42501', 'utente anonimo non può caricare dati demo');
commit;

\echo '=== TUTTI I TEST SQL SUPERATI ==='
