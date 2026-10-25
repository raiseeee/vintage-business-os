\set ON_ERROR_STOP on
\set uid_d '''dddddddd-dddd-dddd-dddd-dddddddddddd'''
\set uid_k '''12121212-1212-1212-1212-121212121212'''
\set uid_x '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''
\set uid_y '''ffffffff-ffff-ffff-ffff-ffffffffffff'''

-- Le vendite già presenti non hanno materiali congelati.
select test.expect_equal((select count(*) from public.sales where materials_cost_cents <> 0), 0, 'inventario: vendite precedenti a 0 materiali');

-- Titolare: crea voci.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
insert into public.inventory_items (kind, name, total_cost_cents, quantity, per_item_qty, in_use)
  values ('materiale', 'Sacchetti', 1000, 100, 1, true);          -- 0,10 € l'uno
insert into public.inventory_items (kind, name, total_cost_cents, quantity, per_item_qty, in_use)
  values ('materiale', 'Scatole', 3000, 50, 0.5, true);            -- 0,60 € l'una, mezza per capo = 0,30
insert into public.inventory_items (kind, name, total_cost_cents, quantity, per_item_qty, in_use)
  values ('materiale', 'Vecchi sacchetti', 500, 10, 1, false);     -- non in uso: non conta
insert into public.inventory_items (kind, name, total_cost_cents, quantity)
  values ('attrezzatura', 'Stampante etichette', 20000, 1);
select test.expect_equal((select count(*) from public.inventory_items), 4, 'inventario: il titolare crea voci');
select test.expect_error($q$insert into public.inventory_items (kind, name, total_cost_cents, quantity, per_item_qty, in_use) values ('attrezzatura', 'x', 100, 1, 1, true)$q$, '23514',
  'inventario: un''attrezzatura non può essere «in uso» per capo');
select test.expect_error($q$insert into public.inventory_items (kind, name, total_cost_cents, quantity) values ('materiale', 'x', 100, 0)$q$, '23514', 'inventario: quantità zero rifiutata');
select test.expect_error($q$insert into public.inventory_items (kind, name, total_cost_cents) values ('materiale', '  ', 100)$q$, '23514', 'inventario: nome vuoto rifiutato');
commit;

-- Vendita: costo materiali congelato = 0,10 + 0,30 = 0,40 €.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
insert into public.items (lot_id, code) select id, 'INV-001' from public.purchase_lots where code = 'SH-L1';
insert into public.items (lot_id, code) select id, 'INV-002' from public.purchase_lots where code = 'SH-L1';
select public.record_sale((select id from public.items where code = 'INV-001'), 'Vinted', current_date, 5000, 300, 400, 0, null);
select test.expect_equal((select materials_cost_cents from public.sales s join public.items i on i.id = s.item_id where i.code = 'INV-001'), 40,
  'inventario: materiali congelati sulla vendita (0,10 + 0,30)');
commit;

-- Cambiare i prezzi dopo NON cambia la vendita già registrata; la nuova usa il prezzo nuovo.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
update public.inventory_items set total_cost_cents = 2000 where name = 'Sacchetti';   -- 0,20 €
select test.expect_equal((select materials_cost_cents from public.sales s join public.items i on i.id = s.item_id where i.code = 'INV-001'), 40,
  'inventario: la vendita già registrata non cambia');
select public.record_sale((select id from public.items where code = 'INV-002'), 'Vinted', current_date, 5000, 300, 400, 0, null);
select test.expect_equal((select materials_cost_cents from public.sales s join public.items i on i.id = s.item_id where i.code = 'INV-002'), 50,
  'inventario: la nuova vendita usa il prezzo aggiornato (0,20 + 0,30)');
-- Rivendita dello stesso capo (upsert): ricalcola.
update public.inventory_items set in_use = false where name = 'Scatole';
select public.record_sale((select id from public.items where code = 'INV-002'), 'Vinted', current_date, 5000, 300, 400, 0, null);
select test.expect_equal((select materials_cost_cents from public.sales s join public.items i on i.id = s.item_id where i.code = 'INV-002'), 20,
  'inventario: materiali non in uso non contano');
commit;

-- Collaboratore: legge, crea, modifica, non elimina.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_k, true);
select test.expect_equal((select count(*) from public.inventory_items), 4, 'inventario: il collaboratore legge');
insert into public.inventory_items (kind, name, total_cost_cents, quantity) values ('materiale', 'Nastro', 300, 3);
update public.inventory_items set notes = 'ok' where name = 'Nastro';
with d as (delete from public.inventory_items returning 1)
select test.expect_equal((select count(*) from d), 0, 'inventario: il collaboratore non elimina');
commit;

-- Esterno e altra attività.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select test.expect_equal((select count(*) from public.inventory_items), 0, 'inventario: l''esterno non vede niente');
select test.expect_error($q$insert into public.inventory_items (kind, name, total_cost_cents) values ('materiale', 'x', 1)$q$, '42501', 'inventario: l''esterno non scrive');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_y, true);
select test.expect_equal((select count(*) from public.inventory_items), 0, 'inventario: un''altra attività non vede i dati');
commit;
begin;
set local role anon;
select test.expect_error($q$select count(*) from public.inventory_items$q$, '42501', 'inventario: anon negato');
commit;

-- Titolare elimina.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
with d as (delete from public.inventory_items where name = 'Nastro' returning 1)
select test.expect_equal((select count(*) from d), 1, 'inventario: il titolare elimina');
commit;

\echo '=== test 04 (inventario) superati ==='
