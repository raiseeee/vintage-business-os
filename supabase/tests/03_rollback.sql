\set ON_ERROR_STOP on
\set uid_a '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set uid_b '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''

select test.expect_equal((select count(*) from information_schema.tables where table_schema = 'public' and table_name like 'business%'), 0,
  'rollback: tabelle dell''attività rimosse');
select test.expect_equal((select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'business_id'), 0,
  'rollback: colonne business_id rimosse');
select test.expect_equal((select count(*) from public.suppliers where user_id = :uid_a), 3, 'rollback: i fornitori sono tutti del titolare');
select test.expect_equal((select count(*) from public.items i join public.purchase_lots l on l.user_id = i.user_id and l.id = i.lot_id), (select count(*) from public.items),
  'rollback: capi ancora collegati ai lotti');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select test.expect_equal((select count(*) from public.suppliers), 3, 'rollback: il titolare rivede i suoi dati');
select public.load_demo_data();
select public.clear_demo_data();
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_b, true);
select test.expect_equal((select count(*) from public.suppliers), 0, 'rollback: un altro utente non vede niente');
commit;
\echo '=== ROLLBACK VERIFICATO ==='
