\set ON_ERROR_STOP on
\set uid_d '''dddddddd-dddd-dddd-dddd-dddddddddddd'''
\set uid_k '''12121212-1212-1212-1212-121212121212'''
\set uid_x '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_k, true);
insert into public.items (lot_id, code) select id, 'PUB-001' from public.purchase_lots where code = 'SH-L1';
update public.items set status = 'pubblicato', listing_channel = 'Vinted', listed_at = current_date where code = 'PUB-001';
select test.expect_equal((select count(*) from public.items where code = 'PUB-001' and listing_channel = 'Vinted' and status = 'pubblicato'), 1,
  'pubblicazione: un collaboratore imposta canale e stato');
select test.expect_error($q$update public.items set listing_channel = '   ' where code = 'PUB-001'$q$, '23514', 'pubblicazione: canale vuoto rifiutato');
select test.expect_error(format($q$update public.items set listing_channel = %L where code = 'PUB-001'$q$, repeat('x', 61)), '23514', 'pubblicazione: canale troppo lungo rifiutato');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select test.expect_equal((select count(*) from public.items where listing_channel is not null), 0, 'pubblicazione: l''esterno non vede i canali');
commit;

\echo '=== test 06 (pubblicazione capi) superati ==='
