-- Attività condivisa: più account lavorano sugli stessi dati.
--
-- COSA FA
--  * crea businesses, business_members, business_invites;
--  * associa TUTTI i dati esistenti alla tua attività (business_id) senza perdere né duplicare righe;
--  * sostituisce i controlli «la riga è mia» con «la riga è della mia attività», verificati dal database;
--  * ruoli: owner (titolare, tutti i poteri) e collaborator (legge, crea e modifica; NON elimina);
--  * inviti con codice casuale, scadenza e accettazione da loggati con la stessa email;
--  * foto: nuove sotto <id attività>/…; le vecchie <uid>/… restano dove sono e restano accessibili.
--
-- SICUREZZA DELL'ESECUZIONE
--  * tutto in UNA transazione: se qualcosa non torna (più utenti con dati, valori nulli, conteggi diversi)
--    la migrazione si interrompe e non cambia niente;
--  * FARE PRIMA UN BACKUP (vedi README): pulsante «Backup completo» + dump del database;
--  * rollback: supabase/rollback/20261025000001_shared_business_down.sql.
--
-- Una persona appartiene a UNA sola attività (vincolo unique su business_members.user_id): le policy
-- si basano su questo. Per più attività per persona vanno riscritte.

begin;

-- ======================================================================
-- 1. Controlli preliminari e fotografia dei conteggi
-- ======================================================================
drop table if exists public._migration_counts;
create table public._migration_counts (tbl text primary key, n bigint not null);
revoke all on public._migration_counts from public, anon, authenticated;

do $pre$
declare
  t text;
  n bigint;
  v_users uuid[];
begin
  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    execute format('select count(*) from public.%I', t) into n;
    insert into public._migration_counts values (t, n);
  end loop;

  select array_agg(distinct u) into v_users from (
    select user_id as u from public.suppliers union     select user_id as u from public.supplier_sources union     select user_id as u from public.supplier_claims union     select user_id as u from public.supplier_evaluations union     select user_id as u from public.contact_log union     select user_id as u from public.purchase_lots union     select user_id as u from public.items union     select user_id as u from public.item_photos union     select user_id as u from public.sales
  ) s;

  if coalesce(cardinality(v_users), 0) > 1 then
    raise exception 'Migrazione interrotta: i dati appartengono a % utenti diversi. Questa migrazione ne prevede uno solo (il titolare).', cardinality(v_users);
  end if;
end;
$pre$;

-- ======================================================================
-- 2. Nuove tabelle
-- ======================================================================
create type public.business_role as enum ('owner', 'collaborator');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.business_role not null default 'collaborator',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id),
  -- Una persona, una attività.
  unique (user_id)
);

create table public.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.business_role not null default 'collaborator',
  -- Solo l'impronta (sha256) del codice: il codice in chiaro si vede una volta sola alla creazione.
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index business_invites_business_idx on public.business_invites (business_id, created_at desc);

-- ======================================================================
-- 3. Funzioni di appartenenza (SECURITY DEFINER, search_path vuoto)
-- ======================================================================
create function public.current_business_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.business_id from public.business_members m where m.user_id = (select auth.uid()) limit 1
$$;

create function public.my_business_role()
returns public.business_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.business_members m where m.user_id = (select auth.uid()) limit 1
$$;

-- Chi sono io: attività, nome e ruolo (nessuna riga se non sono membro di nulla).
create function public.my_membership()
returns table (business_id uuid, business_name text, role public.business_role)
language sql stable security definer set search_path = ''
as $$
  select m.business_id, b.name, m.role
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = (select auth.uid())
$$;

-- Membri della mia attività con la loro email (auth.users non è leggibile dal browser).
create function public.list_members()
returns table (user_id uuid, email text, role public.business_role, joined_at timestamptz, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at, m.user_id = (select auth.uid())
  from public.business_members m
  join auth.users u on u.id = m.user_id
  where m.business_id = public.current_business_id()
  order by m.created_at, u.email
$$;

-- Percorsi delle foto nello storage: <id attività>/… (nuovo) oppure <uid di un membro>/… (vecchio).
-- mode: 'read' | 'insert' | 'delete'. Il vecchio layout non si può scrivere, solo leggere/eliminare.
create function public.photo_path_access(p_name text, p_mode text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_folder text := split_part(p_name, '/', 1);
  v_id uuid;
begin
  if v_uid is null then return false; end if;
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_id := v_folder::uuid;

  -- Nuovo layout: la cartella è l'id di un'attività di cui sono membro (titolare per eliminare).
  if exists (
    select 1 from public.business_members m
    where m.business_id = v_id and m.user_id = v_uid
      and (p_mode <> 'delete' or m.role = 'owner')
  ) then
    return true;
  end if;

  -- Vecchio layout: la cartella è l'id utente di chi ha caricato la foto, oggi membro della mia stessa attività.
  if p_mode in ('read', 'delete') and exists (
    select 1
    from public.business_members theirs
    join public.business_members mine on mine.business_id = theirs.business_id
    where theirs.user_id = v_id and mine.user_id = v_uid
      and (p_mode <> 'delete' or mine.role = 'owner')
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- ======================================================================
-- 4. L'attività del titolare esistente
-- ======================================================================
do $boot$
declare
  v_owner uuid;
  v_business uuid;
begin
  select u into v_owner from (
    select user_id as u from public.suppliers union     select user_id as u from public.supplier_sources union     select user_id as u from public.supplier_claims union     select user_id as u from public.supplier_evaluations union     select user_id as u from public.contact_log union     select user_id as u from public.purchase_lots union     select user_id as u from public.items union     select user_id as u from public.item_photos union     select user_id as u from public.sales
  ) s limit 1;

  -- Nessun dato ma un solo account: sarà il titolare. Altrimenti l'attività si crea con create_business().
  if v_owner is null and (select count(*) from auth.users) = 1 then
    select id into v_owner from auth.users;
  end if;

  if v_owner is not null then
    insert into public.businesses (name) values ('Vintage Business') returning id into v_business;
    insert into public.business_members (business_id, user_id, role) values (v_business, v_owner, 'owner');
  end if;
end;
$boot$;

-- Prima attività su un database vuoto (installazione nuova). Una volta esistita un'attività non si può più usare.
create function public.create_business(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_business uuid;
begin
  if v_uid is null then raise exception 'Utente non autenticato' using errcode = '42501'; end if;
  if exists (select 1 from public.businesses) then
    raise exception 'Esiste già un''attività: le nuove persone entrano con un invito' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Nome mancante' using errcode = '22023'; end if;
  insert into public.businesses (name) values (trim(p_name)) returning id into v_business;
  insert into public.business_members (business_id, user_id, role) values (v_business, v_uid, 'owner');
  return v_business;
end;
$$;

-- ======================================================================
-- 5. Tabelle dei dati: business_id al posto di user_id nei controlli
-- ======================================================================
do $mig$
declare
  t text;
  r record;
  nulls bigint;
begin
  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    execute format('alter table public.%I add column business_id uuid references public.businesses (id) on delete restrict', t);
    execute format($u$update public.%I x set business_id = (select m.business_id from public.business_members m where m.user_id = x.user_id)$u$, t);
    execute format('select count(*) from public.%I where business_id is null', t) into nulls;
    if nulls > 0 then
      raise exception 'Migrazione interrotta: % righe di % non hanno un''attività (il loro utente non è titolare).', nulls, t;
    end if;
  end loop;

  -- Vecchie policy, chiavi composite con user_id e vincoli di unicità legati all'utente.
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename = any(array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales']) loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  for r in select c.conrelid::regclass as tbl, c.conname
           from pg_constraint c join pg_class k on k.oid = c.conrelid join pg_namespace n on n.oid = k.relnamespace
           where n.nspname = 'public' and k.relname = any(array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'])
             and c.contype = 'f' and c.confrelid <> 'auth.users'::regclass loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;

  for r in select c.conrelid::regclass as tbl, c.conname
           from pg_constraint c join pg_class k on k.oid = c.conrelid join pg_namespace n on n.oid = k.relnamespace
           where n.nspname = 'public' and k.relname = any(array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales']) and c.contype = 'u' loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;

  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    execute format('alter table public.%I alter column business_id set not null', t);
    execute format('alter table public.%I alter column business_id set default public.current_business_id()', t);
    execute format('create index %I on public.%I (business_id)', t || '_business_idx', t);

    -- user_id diventa «creato da»: se l'account sparisce, i dati restano.
    for r in select c.conname from pg_constraint c
             where c.conrelid = ('public.' || t)::regclass and c.contype = 'f' and c.confrelid = 'auth.users'::regclass loop
      execute format('alter table public.%I drop constraint %I', t, r.conname);
    end loop;
    execute format('alter table public.%I alter column user_id drop not null', t);
    execute format('alter table public.%I add foreign key (user_id) references auth.users (id) on delete set null', t);
  end loop;
end;
$mig$;

-- Chiavi di unicità e chiavi esterne (stesse regole di prima, ma per attività).
alter table public.suppliers
  add unique (business_id, id);

alter table public.supplier_sources
  add unique (business_id, id),
  add unique (business_id, supplier_id, id),
  add foreign key (business_id, supplier_id) references public.suppliers (business_id, id) on delete cascade;

alter table public.supplier_claims
  add foreign key (business_id, supplier_id) references public.suppliers (business_id, id) on delete cascade,
  add foreign key (business_id, supplier_id, source_id) references public.supplier_sources (business_id, supplier_id, id) on delete restrict;

alter table public.supplier_evaluations
  add foreign key (business_id, supplier_id) references public.suppliers (business_id, id) on delete cascade;

alter table public.contact_log
  add foreign key (business_id, supplier_id) references public.suppliers (business_id, id) on delete cascade;

alter table public.purchase_lots
  add unique (business_id, id),
  add unique (business_id, code),
  add foreign key (business_id, supplier_id) references public.suppliers (business_id, id) on delete restrict;

alter table public.items
  add unique (business_id, id),
  add unique (business_id, code),
  add foreign key (business_id, lot_id) references public.purchase_lots (business_id, id) on delete restrict;

alter table public.item_photos
  add unique (business_id, storage_path),
  add foreign key (business_id, item_id) references public.items (business_id, id) on delete cascade;

alter table public.sales
  add unique (business_id, id),
  add unique (item_id),
  add foreign key (business_id, item_id) references public.items (business_id, id) on delete restrict;

-- L'attività di una riga non si cambia mai.
create function public.prevent_business_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'L''attività di una riga non si può cambiare' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $trg$
declare t text;
begin
  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.prevent_business_change()', t || '_keep_business', t);
  end loop;
end;
$trg$;

-- ======================================================================
-- 6. RLS: appartenenza all'attività (titolare per eliminare)
-- ======================================================================
do $rls$
declare t text;
begin
  foreach t in array array['suppliers', 'supplier_sources', 'supplier_claims', 'supplier_evaluations', 'contact_log', 'purchase_lots', 'items', 'item_photos', 'sales'] loop
    -- (select ...) viene calcolato una volta per query, non per riga.
    execute format($p$create policy "members select" on public.%I for select to authenticated
      using (business_id = (select public.current_business_id()))$p$, t);
    execute format($p$create policy "members insert" on public.%I for insert to authenticated
      with check (business_id = (select public.current_business_id()))$p$, t);
    execute format($p$create policy "members update" on public.%I for update to authenticated
      using (business_id = (select public.current_business_id()))
      with check (business_id = (select public.current_business_id()))$p$, t);
    execute format($p$create policy "owners delete" on public.%I for delete to authenticated
      using (business_id = (select public.current_business_id()) and (select public.my_business_role()) = 'owner')$p$, t);
  end loop;
end;
$rls$;

-- Tabelle di gestione: lettura ai soli interessati, nessuna scrittura diretta (solo tramite le funzioni).
alter table public.businesses enable row level security;
alter table public.businesses force row level security;
alter table public.business_members enable row level security;
alter table public.business_members force row level security;
alter table public.business_invites enable row level security;
alter table public.business_invites force row level security;

revoke all on public.businesses, public.business_members, public.business_invites from anon, authenticated;
grant select on public.businesses, public.business_members, public.business_invites to authenticated;

create policy "members read business" on public.businesses for select to authenticated
  using (id = (select public.current_business_id()));
create policy "members read members" on public.business_members for select to authenticated
  using (business_id = (select public.current_business_id()));
create policy "owners read invites" on public.business_invites for select to authenticated
  using (business_id = (select public.current_business_id()) and (select public.my_business_role()) = 'owner');

-- Rete di sicurezza: l'attività non resta mai senza titolare e i membri non cambiano attività/persona.
create function public.guard_business_members()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.business_id <> old.business_id or new.user_id <> old.user_id then
      raise exception 'Un membro non si sposta tra attività o persone' using errcode = '42501';
    end if;
    if old.role = 'owner' and new.role <> 'owner' then
      raise exception 'Un titolare non si può declassare' using errcode = '42501';
    end if;
    return new;
  end if;

  -- DELETE: se l'attività è già sparita (cancellazione a cascata) si lascia passare.
  if old.role = 'owner'
     and exists (select 1 from public.businesses b where b.id = old.business_id)
     and not exists (
       select 1 from public.business_members m
       where m.business_id = old.business_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'L''attività deve avere almeno un titolare' using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger business_members_guard
  before update or delete on public.business_members
  for each row execute function public.guard_business_members();

-- ======================================================================
-- 7. Inviti e gestione dei membri (solo tramite queste funzioni)
-- ======================================================================
create function public.create_invite(p_email text, p_role public.business_role default 'collaborator', p_valid_days integer default 7)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_business uuid := public.current_business_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
  v_exp timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Utente non autenticato' using errcode = '42501'; end if;
  if public.my_business_role() is distinct from 'owner' then
    raise exception 'Solo un titolare può invitare' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email non valida' using errcode = '22023';
  end if;
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 30 then
    raise exception 'La scadenza va da 1 a 30 giorni' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.business_members m join auth.users u on u.id = m.user_id
    where m.business_id = v_business and lower(u.email) = v_email
  ) then
    raise exception 'Questa persona fa già parte dell''attività' using errcode = '23505';
  end if;

  -- Un solo invito valido per email: i precedenti ancora aperti vengono revocati.
  update public.business_invites i set revoked_at = now()
  where i.business_id = v_business and i.email = v_email and i.accepted_at is null and i.revoked_at is null;

  v_exp := now() + make_interval(days => p_valid_days);
  insert into public.business_invites (business_id, email, role, token_hash, expires_at)
  values (v_business, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_exp)
  returning id into v_id;

  return query select v_id, v_token, v_exp;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_business_role() is distinct from 'owner' then
    raise exception 'Solo un titolare può revocare un invito' using errcode = '42501';
  end if;
  update public.business_invites
  set revoked_at = now()
  where id = p_invite_id and business_id = public.current_business_id()
    and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'Invito non trovato o già chiuso' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Accettazione: solo da loggati, con la stessa email dell'invito. Un messaggio unico per ogni causa di rifiuto.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  v_invite public.business_invites;
begin
  if v_uid is null then raise exception 'Utente non autenticato' using errcode = '42501'; end if;

  select * into v_invite from public.business_invites
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found
     or v_invite.accepted_at is not null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or v_invite.email <> v_email then
    raise exception 'Invito non valido, scaduto o riservato a un''altra email' using errcode = '42501';
  end if;

  if exists (select 1 from public.business_members m where m.user_id = v_uid) then
    raise exception 'Fai già parte di un''attività' using errcode = '23505';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (v_invite.business_id, v_uid, v_invite.role);

  update public.business_invites set accepted_at = now(), accepted_by = v_uid where id = v_invite.id;
  return v_invite.business_id;
end;
$$;

-- Si rimuovono solo i collaboratori: i titolari hanno gli stessi poteri e non si tolgono a vicenda.
create function public.remove_member(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_business_role() is distinct from 'owner' then
    raise exception 'Solo un titolare può rimuovere un collaboratore' using errcode = '42501';
  end if;
  delete from public.business_members
  where user_id = p_user_id and business_id = public.current_business_id() and role = 'collaborator';
  if not found then
    raise exception 'Collaboratore non trovato (i titolari non si rimuovono da qui)' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Promuove un collaboratore a titolare (stessi poteri dei soci). Non esiste il passaggio inverso da qui.
create function public.promote_member(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_business_role() is distinct from 'owner' then
    raise exception 'Solo un titolare può promuovere' using errcode = '42501';
  end if;
  update public.business_members set role = 'owner'
  where user_id = p_user_id and business_id = public.current_business_id() and role = 'collaborator';
  if not found then
    raise exception 'Collaboratore non trovato' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ======================================================================
-- 8. Funzioni già esistenti: solo i titolari annullano vendite e gestiscono i dati demo
-- ======================================================================
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
  if public.my_business_role() is distinct from 'owner' then
    raise exception 'Solo un titolare può annullare una vendita' using errcode = '42501';
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
  if public.my_business_role() is distinct from 'owner' then
    raise exception 'Solo un titolare può caricare i dati demo' using errcode = '42501';
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
  if public.my_business_role() is distinct from 'owner' then
    raise exception 'Solo un titolare può rimuovere i dati demo' using errcode = '42501';
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

-- ======================================================================
-- 9. Storage delle foto (bucket privato)
-- ======================================================================
drop policy if exists "item photos select own folder" on storage.objects;
drop policy if exists "item photos insert own folder" on storage.objects;
drop policy if exists "item photos update own folder" on storage.objects;
drop policy if exists "item photos delete own folder" on storage.objects;

create policy "item photos select members" on storage.objects
  for select to authenticated
  using (bucket_id = 'item-photos' and public.photo_path_access(name, 'read'));

create policy "item photos insert members" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos' and public.photo_path_access(name, 'insert'));

create policy "item photos update members" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-photos' and public.photo_path_access(name, 'insert'))
  with check (bucket_id = 'item-photos' and public.photo_path_access(name, 'insert'));

create policy "item photos delete owners" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-photos' and public.photo_path_access(name, 'delete'));

-- ======================================================================
-- 10. Permessi sulle funzioni (di default Postgres le rende eseguibili da tutti)
-- ======================================================================
revoke all on function
  public.current_business_id(), public.my_business_role(), public.my_membership(), public.list_members(),
  public.photo_path_access(text, text), public.create_business(text),
  public.create_invite(text, public.business_role, integer), public.revoke_invite(uuid),
  public.accept_invite(text), public.remove_member(uuid), public.promote_member(uuid),
  public.guard_business_members(), public.prevent_business_change()
from public, anon;

grant execute on function
  public.current_business_id(), public.my_business_role(), public.my_membership(), public.list_members(),
  public.photo_path_access(text, text), public.create_business(text),
  public.create_invite(text, public.business_role, integer), public.revoke_invite(uuid),
  public.accept_invite(text), public.remove_member(uuid), public.promote_member(uuid)
to authenticated;

revoke all on function public.undo_sale(uuid), public.load_demo_data(), public.clear_demo_data() from public, anon;
grant execute on function public.undo_sale(uuid), public.load_demo_data(), public.clear_demo_data() to authenticated;

-- ======================================================================
-- 11. Verifica finale: stessi conteggi di prima, nessun dato perso o duplicato
-- ======================================================================
do $post$
declare
  c record;
  v_now bigint;
begin
  for c in select m.tbl, m.n as expected from public._migration_counts m loop
    execute format('select count(*) from public.%I', c.tbl) into v_now;
    if v_now <> c.expected then
      raise exception 'Migrazione interrotta: % aveva % righe, ora ne ha %.', c.tbl, c.expected, v_now;
    end if;
  end loop;
end;
$post$;

drop table public._migration_counts;

commit;
