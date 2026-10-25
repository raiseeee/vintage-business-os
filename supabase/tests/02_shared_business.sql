\set ON_ERROR_STOP on
\set uid_a '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set uid_b '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''
\set uid_c '''cccccccc-cccc-cccc-cccc-cccccccccccc'''
\set uid_d '''dddddddd-dddd-dddd-dddd-dddddddddddd'''
\set uid_x '''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'''
\set uid_y '''ffffffff-ffff-ffff-ffff-ffffffffffff'''

-- Account: A = titolare esistente (dati preesistenti), C e D = nuovi soci/collaboratori, X = esterno, Y = altra attività.
update auth.users set email = 'a@example.com' where id = :uid_a;
insert into auth.users (id, email) values
  (:uid_c, 'c@example.com'), (:uid_d, 'd@example.com'), (:uid_x, 'x@example.com'), (:uid_y, 'y@example.com');

-- =====================================================================
-- Dati preesistenti dopo la migrazione (come superutente: nessuna RLS)
-- =====================================================================
select test.expect_equal((select count(*) from public.businesses), 1, 'migrazione: esiste una sola attività');
select test.expect_equal((select count(*) from public.business_members where user_id = :uid_a and role = 'owner'), 1,
  'migrazione: il titolare esistente è owner');
select test.expect_equal((select count(*) from public.suppliers), 3, 'migrazione: i 3 fornitori di A ci sono ancora');
select test.expect_equal((select count(*) from public.suppliers where business_id = (select id from public.businesses)), 3,
  'migrazione: tutti i fornitori hanno l''attività');
select test.expect_equal((select count(*) from public.suppliers where user_id = :uid_a), 3,
  'migrazione: user_id resta come «creato da»');
select test.expect_equal(
  (select count(*) from public.items i join public.purchase_lots l on l.id = i.lot_id and l.business_id = i.business_id), 
  (select count(*) from public.items), 'migrazione: ogni capo resta collegato al suo lotto');
select test.expect_equal(
  (select count(*) from public.purchase_lots l join public.suppliers s on s.id = l.supplier_id and s.business_id = l.business_id),
  (select count(*) from public.purchase_lots), 'migrazione: ogni lotto resta collegato al suo fornitore');

-- =====================================================================
-- Titolare: pieno accesso, vendite, annullamenti, demo
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);

select test.expect_equal((select count(*) from public.suppliers), 3, 'titolare: vede i dati preesistenti');
select test.expect_equal((select count(*) from public.my_membership() where role = 'owner'), 1, 'titolare: my_membership dice owner');

insert into public.suppliers (name) values ('Nuovo fornitore del titolare');
insert into public.purchase_lots (supplier_id, code, purchase_cost_cents, quantity)
  select id, 'SH-L1', 10000, 2 from public.suppliers where name = 'Nuovo fornitore del titolare';
insert into public.items (lot_id, code) select id, 'SH-001' from public.purchase_lots where code = 'SH-L1';
insert into public.items (lot_id, code) select id, 'SH-002' from public.purchase_lots where code = 'SH-L1';
select test.expect_equal((select count(*) from public.items where code like 'SH-%'), 2, 'titolare: crea lotto e capi');

select public.record_sale((select id from public.items where code = 'SH-001'), 'Vinted', current_date, 4000, 300, 500, 0, null);
select test.expect_equal((select count(*) from public.sales), 1, 'titolare: registra una vendita');
select public.undo_sale((select id from public.items where code = 'SH-001'));
select test.expect_equal((select count(*) from public.sales), 0, 'titolare: annulla la vendita');
select public.record_sale((select id from public.items where code = 'SH-002'), 'Vinted', current_date, 3000, 200, 400, 0, null);

select public.load_demo_data();
select test.expect_equal((select count(*) from public.suppliers where is_demo), 2, 'titolare: carica i dati demo');
select public.clear_demo_data();
select test.expect_equal((select count(*) from public.suppliers where is_demo), 0, 'titolare: rimuove i dati demo');

with u as (update public.suppliers set notes = 'modificato' where name = 'Nuovo fornitore del titolare' returning 1)
select test.expect_equal((select count(*) from u), 1, 'titolare: modifica');

select test.expect_error($q$update public.suppliers set business_id = gen_random_uuid()$q$, '42501',
  'titolare: non può spostare una riga in un''altra attività');
commit;

-- =====================================================================
-- Invito: sicurezza di creazione e accettazione
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);
select token as tok_c, invite_id as inv_c from public.create_invite('C@Example.com', 'collaborator', 7) \gset
select test.expect_equal((select count(*) from public.business_invites where email = 'c@example.com' and token_hash <> :'tok_c'), 1,
  'invito: salvata solo l''impronta, email in minuscolo');
select test.expect_equal((select length(:'tok_c')), 64, 'invito: codice lungo 64 caratteri');
select test.expect_error($q$select public.create_invite('non-una-email')$q$, '22023', 'invito: email non valida');
select test.expect_error($q$select public.create_invite('z@example.com', 'collaborator', 90)$q$, '22023', 'invito: scadenza massima 30 giorni');
select test.expect_error($q$select public.create_invite('a@example.com')$q$, '23505', 'invito: chi è già membro non si invita');
commit;

-- Esterno senza invito.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select set_config('request.jwt.claim.email', 'x@example.com', true);
select test.expect_equal((select count(*) from public.suppliers), 0, 'esterno: non vede fornitori');
select test.expect_equal((select count(*) from public.items), 0, 'esterno: non vede capi');
select test.expect_equal((select count(*) from public.sales), 0, 'esterno: non vede vendite');
select test.expect_equal((select count(*) from public.businesses), 0, 'esterno: non vede nessuna attività');
select test.expect_equal((select count(*) from public.business_members), 0, 'esterno: non vede i membri');
select test.expect_equal((select count(*) from public.business_invites), 0, 'esterno: non vede gli inviti');
select test.expect_equal((select count(*) from public.my_membership()), 0, 'esterno: my_membership vuoto');
select test.expect_error($q$insert into public.suppliers (name) values ('intruso')$q$, '42501', 'esterno: non può inserire (nessuna attività)');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select set_config('request.jwt.claim.email', 'x@example.com', true);
select test.expect_error(format($q$select public.accept_invite(%L)$q$, :'tok_c'), '42501', 'esterno: il codice di un altro non funziona (email diversa)');
select test.expect_error($q$select public.accept_invite('inventato')$q$, '42501', 'esterno: codice inventato');
select test.expect_error($q$insert into public.business_members (business_id, user_id, role) select id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'owner' from public.businesses$q$,
  '42501', 'esterno: non può aggiungersi da solo');
select test.expect_error($q$select public.create_invite('x@example.com')$q$, '42501', 'esterno: non può invitare');
select test.expect_error($q$select public.create_business('mia')$q$, '42501', 'esterno: non può creare un''altra attività se ne esiste una');
commit;

-- Collaboratore accetta.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_c, true);
select set_config('request.jwt.claim.email', 'c@example.com', true);
select public.accept_invite(:'tok_c');
select test.expect_equal((select count(*) from public.my_membership() where role = 'collaborator'), 1, 'invito: C entra come collaboratore');
select test.expect_error(format($q$select public.accept_invite(%L)$q$, :'tok_c'), '42501', 'invito: non si usa due volte');
commit;

-- =====================================================================
-- Collaboratore: legge, crea, modifica; non elimina, non gestisce
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_c, true);
select set_config('request.jwt.claim.email', 'c@example.com', true);

select test.expect_equal((select count(*) from public.suppliers), 4, 'collaboratore: vede gli stessi fornitori del titolare');
select test.expect_equal((select count(*) from public.sales), 1, 'collaboratore: vede le vendite');
insert into public.suppliers (name) values ('Fornitore del collaboratore');
with u as (update public.suppliers set notes = 'ok' where name = 'Nuovo fornitore del titolare' returning 1)
select test.expect_equal((select count(*) from u), 1, 'collaboratore: modifica dati condivisi');
insert into public.items (lot_id, code) select id, 'SH-003' from public.purchase_lots where code = 'SH-L1';
select public.record_sale((select id from public.items where code = 'SH-003'), 'Vinted', current_date, 2500, 100, 300, 0, null);
select test.expect_equal((select count(*) from public.sales), 2, 'collaboratore: registra una vendita');

with d as (delete from public.suppliers where name = 'Fornitore del collaboratore' returning 1)
select test.expect_equal((select count(*) from d), 0, 'collaboratore: NON elimina fornitori');
with d as (delete from public.sales returning 1)
select test.expect_equal((select count(*) from d), 0, 'collaboratore: NON elimina vendite');
with d as (delete from public.items returning 1)
select test.expect_equal((select count(*) from d), 0, 'collaboratore: NON elimina capi');
select test.expect_error($q$select public.undo_sale((select id from public.items where code = 'SH-003'))$q$, '42501', 'collaboratore: NON annulla vendite');
select test.expect_error($q$select public.load_demo_data()$q$, '42501', 'collaboratore: NON carica dati demo');
select test.expect_error($q$select public.clear_demo_data()$q$, '42501', 'collaboratore: NON rimuove dati demo');

select test.expect_error($q$select public.create_invite('nuovo@example.com')$q$, '42501', 'collaboratore: NON invita');
select test.expect_error($q$select public.promote_member('cccccccc-cccc-cccc-cccc-cccccccccccc')$q$, '42501', 'collaboratore: NON si promuove');
select test.expect_error($q$select public.remove_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$, '42501', 'collaboratore: NON rimuove nessuno');
select test.expect_error($q$update public.business_members set role = 'owner' where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$q$, '42501',
  'collaboratore: update diretto del ruolo negato');
select test.expect_error($q$delete from public.business_members where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$, '42501',
  'collaboratore: delete diretto dei membri negato');
select test.expect_error($q$insert into public.businesses (name) values ('x')$q$, '42501', 'collaboratore: non crea attività');
select test.expect_error($q$update public.businesses set name = 'x'$q$, '42501', 'collaboratore: non rinomina l''attività');
select test.expect_equal((select count(*) from public.business_invites), 0, 'collaboratore: non vede gli inviti');
select test.expect_equal((select count(*) from public.list_members()), 2, 'collaboratore: vede la lista dei membri');
commit;

-- =====================================================================
-- Revoca, scadenza, email sbagliata, già membro
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);
select token as tok_d, invite_id as inv_d from public.create_invite('d@example.com') \gset
select public.revoke_invite(:'inv_d');
select test.expect_error(format($q$select public.revoke_invite(%L)$q$, :'inv_d'), 'P0002', 'invito: già revocato');
select token as tok_d2 from public.create_invite('d@example.com') \gset
select token as tok_d3, invite_id as inv_d3 from public.create_invite('d@example.com') \gset
select test.expect_equal((select count(*) from public.business_invites where email = 'd@example.com' and revoked_at is null and accepted_at is null), 1,
  'invito: un solo invito aperto per email');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
select set_config('request.jwt.claim.email', 'd@example.com', true);
select test.expect_error(format($q$select public.accept_invite(%L)$q$, :'tok_d'), '42501', 'invito revocato non si accetta');
select test.expect_error(format($q$select public.accept_invite(%L)$q$, :'tok_d2'), '42501', 'invito sostituito non si accetta');
commit;

update public.business_invites set expires_at = now() - interval '1 minute' where id = :'inv_d3';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
select set_config('request.jwt.claim.email', 'd@example.com', true);
select test.expect_error(format($q$select public.accept_invite(%L)$q$, :'tok_d3'), '42501', 'invito scaduto non si accetta');
commit;

-- Il titolare vede gli stati.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);
select test.expect_equal((select count(*) from public.business_invites where accepted_at is not null), 1, 'titolare: vede inviti accettati');
select test.expect_equal((select count(*) from public.business_invites where revoked_at is not null), 2, 'titolare: vede inviti revocati');
commit;

-- Invito a titolare (socio) e accettazione.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);
select token as tok_d4 from public.create_invite('d@example.com', 'owner', 7) \gset
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
select set_config('request.jwt.claim.email', 'd@example.com', true);
select public.accept_invite(:'tok_d4');
select test.expect_equal((select count(*) from public.my_membership() where role = 'owner'), 1, 'socio invitato come titolare: D è owner');
with d as (delete from public.sales where channel = 'Vinted' and price_cents = 2500 returning 1)
select test.expect_equal((select count(*) from d), 1, 'socio titolare: può eliminare');
commit;

-- Rimozione di un collaboratore: perde subito l'accesso.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);
select test.expect_error($q$select public.remove_member('dddddddd-dddd-dddd-dddd-dddddddddddd')$q$, 'P0002', 'i titolari non si rimuovono tra loro');
select test.expect_error($q$select public.remove_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$, 'P0002', 'il titolare non rimuove se stesso');
select public.remove_member('cccccccc-cccc-cccc-cccc-cccccccccccc');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_c, true);
select set_config('request.jwt.claim.email', 'c@example.com', true);
select test.expect_equal((select count(*) from public.suppliers), 0, 'ex collaboratore: non vede più niente');
commit;
select test.expect_equal((select count(*) from public.suppliers where name = 'Fornitore del collaboratore'), 1,
  'rimuovere un collaboratore non cancella ciò che ha creato');

-- Un collaboratore può diventare titolare solo per mano di un titolare.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);
select token as tok_c2 from public.create_invite('c@example.com') \gset
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_c, true);
select set_config('request.jwt.claim.email', 'c@example.com', true);
select public.accept_invite(:'tok_c2');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select set_config('request.jwt.claim.email', 'a@example.com', true);
select public.promote_member('cccccccc-cccc-cccc-cccc-cccccccccccc');
select test.expect_equal((select count(*) from public.list_members() where role = 'owner'), 3, 'promote_member: tre titolari');
commit;

-- =====================================================================
-- Sempre almeno un titolare
-- =====================================================================
select test.expect_error($q$update public.business_members set role = 'collaborator' where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$, '42501',
  'un titolare non si declassa');
select test.expect_error($q$update public.business_members set user_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$, '42501',
  'un membro non cambia persona');

-- =====================================================================
-- Due attività separate (inserite da superutente: nessuna funzione le crea)
-- =====================================================================
insert into public.businesses (id, name) values ('99999999-9999-9999-9999-999999999999', 'Altra attività');
insert into public.business_members (business_id, user_id, role) values ('99999999-9999-9999-9999-999999999999', :uid_y, 'owner');
insert into public.suppliers (name, business_id, user_id) values ('Fornitore di Y', '99999999-9999-9999-9999-999999999999', :uid_y);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_a, true);
select test.expect_equal((select count(*) from public.suppliers where name = 'Fornitore di Y'), 0, 'due attività: A non vede i dati di Y');
select test.expect_error(
  $q$insert into public.suppliers (name, business_id) values ('infiltrato', '99999999-9999-9999-9999-999999999999')$q$, '42501',
  'due attività: A non scrive nell''attività di Y');
select test.expect_equal((select count(*) from public.businesses), 1, 'due attività: A vede solo la sua');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_y, true);
select test.expect_equal((select count(*) from public.suppliers), 1, 'due attività: Y vede solo il suo');
select test.expect_equal((select count(*) from public.sales), 0, 'due attività: Y non vede le vendite di A');
commit;

-- =====================================================================
-- Foto private (storage)
-- =====================================================================
select test.expect_equal((select count(*) from storage.buckets where id = 'item-photos' and not public), 1, 'storage: bucket privato');

-- Un file vecchio (cartella = uid di A) e uno nuovo (cartella = id attività).
insert into storage.objects (bucket_id, name) values
  ('item-photos', :uid_a || '/11111111-1111-1111-1111-111111111111/old.jpg'),
  ('item-photos', (select id::text from public.businesses where name = 'Vintage Business') || '/11111111-1111-1111-1111-111111111111/new.jpg'),
  ('item-photos', '99999999-9999-9999-9999-999999999999/22222222-2222-2222-2222-222222222222/y.jpg');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
select test.expect_equal((select count(*) from storage.objects), 3, 'storage: un socio legge foto vecchie (anche preesistenti) e nuove, non quelle di Y');
select test.expect_error(
  format($q$insert into storage.objects (bucket_id, name) values ('item-photos', %L)$q$, :uid_a || '/x/hack.jpg'), '42501',
  'storage: nel vecchio layout non si scrive più');
insert into storage.objects (bucket_id, name)
  select 'item-photos', id::text || '/33333333-3333-3333-3333-333333333333/ok.jpg' from public.businesses where name = 'Vintage Business';
select test.expect_error(
  $q$insert into storage.objects (bucket_id, name) values ('item-photos', '99999999-9999-9999-9999-999999999999/x/hack.jpg')$q$, '42501',
  'storage: non si scrive nella cartella di un''altra attività');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_x, true);
select test.expect_equal((select count(*) from storage.objects), 0, 'storage: l''esterno non vede nessuna foto');
select test.expect_error(
  format($q$insert into storage.objects (bucket_id, name) values ('item-photos', %L)$q$, :uid_x || '/x/y.jpg'), '42501',
  'storage: l''esterno non carica nemmeno nella propria cartella');
with d as (delete from storage.objects returning 1)
select test.expect_equal((select count(*) from d), 0, 'storage: l''esterno non elimina');
commit;

begin;
set local role anon;
select test.expect_error($q$select count(*) from storage.objects$q$, '42501', 'storage: anon non legge');
commit;

-- Collaboratore (dopo promozione C è titolare: ne creiamo uno nuovo senza ruolo di eliminazione)
insert into auth.users (id, email) values ('12121212-1212-1212-1212-121212121212', 'k@example.com');
insert into public.business_members (business_id, user_id, role)
  select id, '12121212-1212-1212-1212-121212121212', 'collaborator' from public.businesses where name = 'Vintage Business';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '12121212-1212-1212-1212-121212121212', true);
select test.expect_equal((select count(*) from storage.objects), 4, 'storage: il collaboratore legge');
with d as (delete from storage.objects returning 1)
select test.expect_equal((select count(*) from d), 0, 'storage: il collaboratore non elimina foto');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :uid_d, true);
with d as (delete from storage.objects where name like '%/old.jpg' returning 1)
select test.expect_equal((select count(*) from d), 1, 'storage: un titolare elimina una foto vecchia');
with d as (delete from storage.objects where name like '%/new.jpg' returning 1)
select test.expect_equal((select count(*) from d), 1, 'storage: un titolare elimina una foto nuova');
commit;

-- =====================================================================
-- Permessi sulle funzioni
-- =====================================================================
begin;
set local role anon;
select test.expect_error($q$select public.accept_invite('x')$q$, '42501', 'anon: accept_invite negato');
select test.expect_error($q$select public.create_invite('a@b.it')$q$, '42501', 'anon: create_invite negato');
select test.expect_error($q$select public.list_members()$q$, '42501', 'anon: list_members negato');
select test.expect_error($q$select public.current_business_id()$q$, '42501', 'anon: current_business_id negato');
commit;

-- =====================================================================
-- Eliminare un account non elimina i dati
-- =====================================================================
select count(*) as n_sup_before from public.suppliers \gset
select count(*) as n_items_before from public.items \gset
delete from auth.users where id = :uid_a;
select test.expect_equal((select count(*) from public.suppliers), :n_sup_before, 'eliminare un account non cancella i fornitori');
select test.expect_equal((select count(*) from public.items), :n_items_before, 'eliminare un account non cancella i capi');
select test.expect_equal((select count(*) from public.suppliers where user_id is null), 4, 'i dati restano senza «creato da»');

-- L'ultimo titolare non si può togliere.
delete from public.business_members where user_id = :uid_c;
select test.expect_error(format($q$delete from public.business_members where user_id = %L$q$, :uid_d), '23514',
  'l''ultimo titolare non si può eliminare');

\echo '=== TUTTI I TEST SQL SUPERATI ==='
