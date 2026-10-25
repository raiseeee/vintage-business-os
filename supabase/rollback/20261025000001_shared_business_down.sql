-- ROLLBACK della migrazione 20261025000001_shared_business.sql (torna al modello a un solo utente).
-- NON è in supabase/migrations: va eseguito a mano, solo se serve, nello SQL Editor.
--
-- ATTENZIONE
--  * Nel modello a un solo utente ogni riga ha un unico proprietario: tutte le righe passano al PRIMO titolare
--    (il socio entrato per primo). Le altre persone perdono l'accesso e la tabella dei membri/inviti sparisce.
--  * Le foto caricate col nuovo percorso (<id attività>/…) NON sono più raggiungibili dalle vecchie policy
--    (che vogliono <id utente>/…). Se ne sono state caricate di nuove, non fare il rollback senza prima spostarle.
--    Le foto vecchie (<id utente>/…) restano accessibili al titolare che le ha caricate.
--  * Va usato con la versione precedente dell'app (prima del commit «attività condivisa»).

begin;

do $chk$
begin
  if not exists (select 1 from public.business_members where role = 'owner') then
    raise exception 'Nessun titolare trovato: niente da ripristinare.';
  end if;
end;
$chk$;

-- Policy nuove (tabelle dati e storage) e trigger.
do $rb$
declare
  t text;
  r record;
  v_owner uuid;
begin
  select user_id into v_owner from public.business_members where role = 'owner' order by created_at, user_id limit 1;

  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename = any(array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales']) loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_keep_business', t);
    -- Chi ha creato la riga non conta più: tutto al primo titolare.
    execute format('update public.%I set user_id = %L where user_id is distinct from %L', t, v_owner, v_owner);
  end loop;

  for r in select c.conrelid::regclass as tbl, c.conname
           from pg_constraint c join pg_class k on k.oid = c.conrelid join pg_namespace n on n.oid = k.relnamespace
           where n.nspname = 'public' and k.relname = any(array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'])
             and c.contype = 'f' loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
  for r in select c.conrelid::regclass as tbl, c.conname
           from pg_constraint c join pg_class k on k.oid = c.conrelid join pg_namespace n on n.oid = k.relnamespace
           where n.nspname = 'public' and k.relname = any(array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales']) and c.contype = 'u' loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;

  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    execute format('alter table public.%I drop column business_id', t);
    execute format('alter table public.%I alter column user_id set not null', t);
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
    execute format('alter table public.%I add foreign key (user_id) references auth.users (id) on delete cascade', t);
  end loop;
end;
$rb$;

alter table public.suppliers add unique (user_id, id);
alter table public.supplier_sources
  add unique (user_id, id), add unique (user_id, supplier_id, id),
  add foreign key (user_id, supplier_id) references public.suppliers (user_id, id) on delete cascade;
alter table public.supplier_claims
  add foreign key (user_id, supplier_id) references public.suppliers (user_id, id) on delete cascade,
  add foreign key (user_id, supplier_id, source_id) references public.supplier_sources (user_id, supplier_id, id) on delete restrict;
alter table public.supplier_evaluations
  add foreign key (user_id, supplier_id) references public.suppliers (user_id, id) on delete cascade;
alter table public.contact_log
  add foreign key (user_id, supplier_id) references public.suppliers (user_id, id) on delete cascade;
alter table public.purchase_lots
  add unique (user_id, id), add unique (user_id, code),
  add foreign key (user_id, supplier_id) references public.suppliers (user_id, id) on delete restrict;
alter table public.items
  add unique (user_id, id), add unique (user_id, code),
  add foreign key (user_id, lot_id) references public.purchase_lots (user_id, id) on delete restrict;
alter table public.item_photos
  add unique (user_id, storage_path),
  add foreign key (user_id, item_id) references public.items (user_id, id) on delete cascade;
alter table public.sales
  add unique (user_id, id), add unique (item_id),
  add foreign key (user_id, item_id) references public.items (user_id, id) on delete restrict;

do $pol$
declare t text;
begin
  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    execute format($p$create policy "own rows select" on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own rows update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own rows delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))$p$, t);
  end loop;
end;
$pol$;

-- Storage: di nuovo una cartella per utente.
drop policy if exists "item photos select members" on storage.objects;
drop policy if exists "item photos insert members" on storage.objects;
drop policy if exists "item photos update members" on storage.objects;
drop policy if exists "item photos delete owners" on storage.objects;

create policy "item photos select own folder" on storage.objects for select to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "item photos insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "item photos update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "item photos delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Funzioni di prima (senza controllo del ruolo).
create or replace function public.undo_sale(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  delete from public.sales where item_id = p_item_id;
  if not found then
    raise exception 'Vendita non trovata' using errcode = 'no_data_found';
  end if;

  update public.items set status = 'pronto' where id = p_item_id;
end;
$$;

create or replace function public.load_demo_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sup_a uuid;
  v_sup_b uuid;
  v_src uuid;
  v_lot uuid;
  v_item_sold uuid;
begin
  if v_uid is null then
    raise exception 'Utente non autenticato';
  end if;

  if exists (select 1 from public.suppliers where is_demo) then
    raise exception 'I dati demo sono già presenti. Rimuovili prima con clear_demo_data().';
  end if;

  -- Fornitore A: grossista con provenienza documentata (fonte fittizia).
  insert into public.suppliers (name, website, country, languages, stock_types, brands,
      min_order_qty, min_order_weight_kg, price_per_kg_cents, price_notes,
      contact_status, notes, is_demo)
  values ('[DEMO] Esempio Grossista A', 'https://example.com/demo-a', 'DE',
      array['de','en'], array['sportswear','streetwear'], array['[DEMO] Marca A'],
      50, 100, 650, 'Prezzo di esempio, non reale',
      'contattata', 'Dato demo: non è un fornitore reale.', true)
  returning id into v_sup_a;

  insert into public.supplier_sources (supplier_id, url, title, retrieved_at, note)
  values (v_sup_a, 'https://example.com/demo-fonte', '[DEMO] Fonte di esempio', current_date,
      'Fonte fittizia a scopo dimostrativo')
  returning id into v_src;

  insert into public.supplier_claims (supplier_id, field, statement, evidence_level, source_id)
  values
    (v_sup_a, 'provenienza', '[DEMO] Provenienza documentata da fonte di esempio', 'documentato', v_src),
    (v_sup_a, 'moq', '[DEMO] Ordine minimo dichiarato dall''azienda', 'dichiarato', null);

  update public.suppliers set supplier_type = 'grossista_documentato' where id = v_sup_a;

  insert into public.supplier_evaluations
    (supplier_id, proximity, transparency, min_order, budget_fit, vintage_interest, comment)
  values (v_sup_a, 3, 4, 3, 4, 4, '[DEMO] Valutazione di esempio');

  insert into public.contact_log (supplier_id, channel, summary)
  values (v_sup_a, 'email', '[DEMO] Primo contatto di esempio');

  -- Fornitore B: origine non verificata, nessuna prova.
  insert into public.suppliers (name, website, country, languages, stock_types,
      contact_status, notes, is_demo)
  values ('[DEMO] Esempio Rivenditore B', 'https://example.com/demo-b', 'IT',
      array['it'], array['misto'],
      'da_contattare', 'Dato demo: non è un fornitore reale.', true)
  returning id into v_sup_b;

  -- Lotto demo: 10 capi, 150,00 € merce + 25,00 € spedizione + 5,00 € altri costi.
  insert into public.purchase_lots (supplier_id, code, purchase_cost_cents,
      inbound_shipping_cents, other_costs_cents, quantity, weight_kg, notes, is_demo)
  values (v_sup_a, 'DEMO-L1', 15000, 2500, 500, 10, 8.5, 'Lotto demo', true)
  returning id into v_lot;

  insert into public.items (lot_id, code, brand, category, size, condition, status,
      expected_price_cents, notes, is_demo)
  values
    (v_lot, 'DEMO-001', '[DEMO] Marca A', 'Felpa', 'L', 'buona', 'pubblicato', 4500, 'Capo demo', true),
    (v_lot, 'DEMO-002', '[DEMO] Marca A', 'Giacca', 'M', 'ottima', 'pronto', 7000, 'Capo demo', true),
    (v_lot, 'DEMO-003', '[DEMO] Marca B', 'T-shirt', 'XL', 'discreta', 'da_fotografare', 2500, 'Capo demo', true);

  insert into public.items (lot_id, code, brand, category, size, condition, status,
      expected_price_cents, notes, is_demo)
  values (v_lot, 'DEMO-004', '[DEMO] Marca A', 'Pantaloni', 'M', 'buona', 'venduto', 4000, 'Capo demo', true)
  returning id into v_item_sold;

  insert into public.sales (item_id, channel, price_cents, fees_cents,
      outbound_shipping_cents, extra_costs_cents, notes)
  values (v_item_sold, '[DEMO] Canale di esempio', 4500, 300, 500, 100, 'Vendita demo');
end;
$$;

create or replace function public.clear_demo_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  -- Ordine imposto dalle chiavi esterne "restrict": vendite → capi → lotti → fornitori.
  delete from public.sales
    where item_id in (select id from public.items where is_demo);
  delete from public.items where is_demo;
  delete from public.purchase_lots where is_demo;
  -- Fonti, prove, valutazioni e contatti vengono eliminati a cascata.
  -- Le prove vanno tolte prima delle fonti (restrict) e dopo il tipo del fornitore.
  update public.suppliers set supplier_type = 'origine_non_verificata' where is_demo;
  delete from public.supplier_claims
    where supplier_id in (select id from public.suppliers where is_demo);
  delete from public.suppliers where is_demo;
end;
$$;

-- Tabelle e funzioni dell'attività condivisa.
drop function public.photo_path_access(text, text);
drop function public.create_invite(text, public.business_role, integer);
drop function public.revoke_invite(uuid);
drop function public.accept_invite(text);
drop function public.remove_member(uuid);
drop function public.promote_member(uuid);
drop function public.create_business(text);
drop function public.list_members();
drop function public.my_membership();
drop table public.business_invites;
drop table public.business_members;
drop table public.businesses;
drop function public.guard_business_members();
drop function public.prevent_business_change();
drop function public.current_business_id();
drop function public.my_business_role();
drop type public.business_role;

commit;
