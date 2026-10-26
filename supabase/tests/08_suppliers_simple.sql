\set ON_ERROR_STOP on
\set uid_d '''dddddddd-dddd-dddd-dddd-dddddddddddd'''
\set uid_k '''12121212-1212-1212-1212-121212121212'''
\set uid_x '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''

-- I nomi scritti sui lotti sono diventati fornitori collegati; il testo è sparito.
select test.expect_equal((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'purchase_lots' and column_name = 'supplier_name'), 0,
  'fornitori: colonna supplier_name tolta dal lotto');
select test.expect_equal((select count(*) from public.purchase_lots l join public.suppliers s on s.id = l.supplier_id
  where l.code = 'SH-L1' and s.name = 'Nuovo fornitore del titolare'), 1, 'fornitori: il nome sul lotto è diventato un fornitore collegato');
select test.expect_equal((select count(*) from public.purchase_lots l join public.suppliers s on s.id = l.supplier_id
  where l.code = 'NOSUP-1' and s.name = 'Mercato di Prato'), 1, 'fornitori: anche il nome inserito dal collaboratore');
select test.expect_equal((select count(*) from public.purchase_lots where code = 'NOSUP-2' and supplier_id is null), 1, 'fornitori: i lotti senza nome restano senza fornitore');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_k, true);
insert into public.suppliers (name, email, phone, address) values ('Magazzino Roma', 'info@example.com', '+39 06 000000', 'Via Roma 1');
select test.expect_equal((select count(*) from public.suppliers where name = 'Magazzino Roma'), 1, 'fornitori: il collaboratore crea');
update public.purchase_lots set supplier_id = (select id from public.suppliers where name = 'Magazzino Roma') where code = 'NOSUP-2';
select test.expect_equal((select count(*) from public.purchase_lots where code = 'NOSUP-2' and supplier_id is not null), 1, 'fornitori: collega un lotto');
select test.expect_error($q$insert into public.suppliers (name) values ('   ')$q$, '23514', 'fornitori: nome vuoto rifiutato');
with d as (delete from public.suppliers where name = 'Magazzino Roma' returning 1)
select test.expect_equal((select count(*) from d), 0, 'fornitori: il collaboratore NON elimina');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select test.expect_equal((select count(*) from public.suppliers), 0, 'fornitori: l''esterno non vede nulla');
select test.expect_error($q$insert into public.suppliers (name) values ('intruso')$q$, '42501', 'fornitori: l''esterno non crea');
commit;

-- Un titolare elimina il fornitore: il lotto resta, senza fornitore.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
select set_config('request.jwt.claim.email', 'd@example.com', true);
with d as (delete from public.suppliers where name = 'Magazzino Roma' returning 1)
select test.expect_equal((select count(*) from d), 1, 'fornitori: il titolare elimina');
select test.expect_equal((select count(*) from public.purchase_lots where code = 'NOSUP-2' and supplier_id is null), 1, 'fornitori: il lotto resta, senza fornitore');
commit;

\echo '=== test 08 (fornitori semplici) superati ==='
