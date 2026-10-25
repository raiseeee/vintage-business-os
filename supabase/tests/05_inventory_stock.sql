\set ON_ERROR_STOP on
\set uid_d '''dddddddd-dddd-dddd-dddd-dddddddddddd'''
\set uid_k '''12121212-1212-1212-1212-121212121212'''
\set uid_x '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''

-- Materiale con 50 pezzi, 2 per capo.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
insert into public.inventory_items (kind, name, total_cost_cents, quantity, per_item_qty, in_use)
  values ('materiale', 'Etichette', 500, 50, 2, true);
insert into public.items (lot_id, code) select id, 'STK-001' from public.purchase_lots where code = 'SH-L1';
insert into public.items (lot_id, code) select id, 'STK-002' from public.purchase_lots where code = 'SH-L1';
select public.record_sale((select id from public.items where code = 'STK-001'), 'Vinted', current_date, 5000, 300, 400, 0, null);
select test.expect_numeric(
  (select coalesce(sum(sm.qty), 0) from public.sale_materials sm join public.inventory_items i on i.id = sm.inventory_item_id where i.name = 'Etichette'),
  2, 'giacenza: una vendita consuma 2 etichette');
select public.record_sale((select id from public.items where code = 'STK-002'), 'Vinted', current_date, 5000, 300, 400, 0, null);
select test.expect_numeric(
  (select quantity - sum(sm.qty) from public.sale_materials sm join public.inventory_items i on i.id = sm.inventory_item_id where i.name = 'Etichette' group by i.quantity),
  46, 'giacenza: dopo due vendite restano 46 su 50');
commit;

-- Registrare di nuovo la stessa vendita non consuma due volte.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
select public.record_sale((select id from public.items where code = 'STK-001'), 'Vinted', current_date, 5200, 300, 400, 0, null);
select test.expect_numeric(
  (select sum(sm.qty) from public.sale_materials sm join public.inventory_items i on i.id = sm.inventory_item_id where i.name = 'Etichette'),
  4, 'giacenza: la vendita ripetuta non raddoppia il consumo');
-- Spegnendo il materiale prima di una nuova registrazione, quella vendita non lo consuma più.
update public.inventory_items set in_use = false where name = 'Etichette';
select public.record_sale((select id from public.items where code = 'STK-001'), 'Vinted', current_date, 5200, 300, 400, 0, null);
select test.expect_numeric(
  (select sum(sm.qty) from public.sale_materials sm join public.inventory_items i on i.id = sm.inventory_item_id where i.name = 'Etichette'),
  2, 'giacenza: materiale non più in uso non viene consumato dalla nuova registrazione');
commit;

-- Annullare una vendita ripristina la giacenza (solo titolare).
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
select public.undo_sale((select id from public.items where code = 'STK-002'));
select test.expect_numeric(
  (select coalesce(sum(sm.qty), 0) from public.sale_materials sm join public.inventory_items i on i.id = sm.inventory_item_id where i.name = 'Etichette'),
  0, 'giacenza: annullare la vendita restituisce i pezzi');
commit;

-- Collaboratore: registra vendite (consuma), non vede altre attività.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_k, true);
update public.inventory_items set in_use = true where name = 'Etichette';
insert into public.items (lot_id, code) select id, 'STK-003' from public.purchase_lots where code = 'SH-L1';
select public.record_sale((select id from public.items where code = 'STK-003'), 'Vinted', current_date, 3000, 100, 300, 0, null);
select test.expect_equal((select count(*) from public.sale_materials sm join public.inventory_items i on i.id = sm.inventory_item_id where i.name = 'Etichette'), 1,
  'giacenza: il collaboratore registra una vendita che consuma');
select public.record_sale((select id from public.items where code = 'STK-003'), 'Vinted', current_date, 3100, 100, 300, 0, null);
select test.expect_equal((select count(*) from public.sale_materials sm join public.inventory_items i on i.id = sm.inventory_item_id where i.name = 'Etichette'), 1,
  'giacenza: il collaboratore può ripetere la registrazione');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select test.expect_equal((select count(*) from public.sale_materials), 0, 'giacenza: l''esterno non vede i consumi');
select test.expect_error($q$insert into public.sale_materials (sale_id, inventory_item_id, qty) values (gen_random_uuid(), gen_random_uuid(), 1)$q$, '42501', 'giacenza: l''esterno non scrive');
commit;
begin;
set local role anon;
select test.expect_error($q$select count(*) from public.sale_materials$q$, '42501', 'giacenza: anon negato');
commit;

-- Eliminare il materiale elimina i suoi consumi (a cascata), non le vendite.
select count(*) as n_sales_before from public.sales \gset
delete from public.inventory_items where name = 'Etichette';
select test.expect_equal((select count(*) from public.sales), :n_sales_before, 'giacenza: eliminare un materiale non elimina le vendite');

\echo '=== test 05 (giacenza materiali) superati ==='
