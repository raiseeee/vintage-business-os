\set ON_ERROR_STOP on
\set uid_k '''12121212-1212-1212-1212-121212121212'''
\set uid_x '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''

-- Struttura: tabelle, colonne, funzioni e tipi dei fornitori sono spariti.
select test.expect_equal((select count(*) from information_schema.tables where table_schema = 'public'
  and table_name in ('suppliers','supplier_sources','supplier_claims','supplier_evaluations','contact_log','search_runs','search_results')), 0,
  'fornitori: tabelle rimosse');
select test.expect_equal((select count(*) from information_schema.columns where table_schema = 'public'
  and ((table_name = 'purchase_lots' and column_name in ('supplier_id','is_demo')) or (table_name = 'items' and column_name = 'is_demo'))), 0,
  'fornitori: colonne supplier_id e is_demo rimosse');
select test.expect_equal((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('load_demo_data','clear_demo_data','supplier_has_documented_origin','enforce_supplier_type_evidence','protect_origin_evidence')), 0,
  'fornitori: funzioni rimosse');
select test.expect_equal((select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'
  and t.typname in ('supplier_type','contact_status','contact_channel','evidence_level')), 0, 'fornitori: tipi rimossi');
select test.expect_equal((select count(*) from information_schema.tables where table_schema = 'public' and table_name = '_remove_suppliers_check'), 0,
  'fornitori: nessuna tabella di appoggio rimasta');

-- Dati veri intatti e nome fornitore copiato sul lotto.
select test.expect_equal((select count(*) from public.purchase_lots), :lots_before, 'fornitori: lotti intatti');
select test.expect_equal((select count(*) from public.items), :items_before, 'fornitori: capi intatti');
select test.expect_equal((select count(*) from public.sales), :sales_before, 'fornitori: vendite intatte');
select test.expect_equal((select count(*) from public.purchase_lots where code = 'SH-L1' and supplier_name = 'Nuovo fornitore del titolare'), 1,
  'fornitori: il nome del fornitore è stato copiato sul lotto');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_k, true);
insert into public.purchase_lots (code, purchase_cost_cents, quantity, supplier_name) values ('NOSUP-1', 5000, 2, 'Mercato di Prato');
insert into public.purchase_lots (code, purchase_cost_cents, quantity) values ('NOSUP-2', 5000, 2);
select test.expect_equal((select count(*) from public.purchase_lots where code = 'NOSUP-1' and supplier_name = 'Mercato di Prato'), 1, 'lotto: il collaboratore indica il fornitore a testo libero');
select test.expect_equal((select count(*) from public.purchase_lots where code = 'NOSUP-2' and supplier_name is null), 1, 'lotto: il fornitore è facoltativo');
select test.expect_error(format($q$update public.purchase_lots set supplier_name = %L where code = 'NOSUP-1'$q$, repeat('x', 121)), '23514', 'lotto: nome fornitore troppo lungo rifiutato');
insert into public.items (lot_id, code) select id, 'NOSUP-1-A' from public.purchase_lots where code = 'NOSUP-1';
select public.record_sale((select id from public.items where code = 'NOSUP-1-A'), 'Vinted', current_date, 4000, 0, 0, 0, null);
select test.expect_equal((select count(*) from public.items where code = 'NOSUP-1-A' and status = 'venduto'), 1, 'vendita: funziona dopo la rimozione');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select test.expect_equal((select count(*) from public.purchase_lots where supplier_name is not null), 0, 'lotto: l''esterno non vede i nomi dei fornitori');
commit;

\echo '=== test 07 (rimozione fornitori) superati ==='
