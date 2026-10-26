-- Fornitori (versione semplice): nome, email, telefono, indirizzo, note + storico dei lotti.
-- Va applicata DOPO 20261029000001_remove_suppliers.sql.
-- I nomi già scritti sui lotti (supplier_name) diventano fornitori veri e il testo viene tolto dal lotto.
-- Chi può: tutti i membri leggono, creano e modificano; eliminare solo i titolari
-- (un fornitore eliminato lascia i suoi lotti, che restano senza fornitore).
do $migration$
declare
  v_lots bigint;
begin
  select count(*) into v_lots from public.purchase_lots;

  create table if not exists public.suppliers (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null default public.current_business_id() references public.businesses (id) on delete restrict,
    user_id uuid default auth.uid() references auth.users (id) on delete set null,
    name text not null check (length(trim(name)) > 0 and char_length(name) <= 120),
    email text check (email is null or char_length(email) <= 200),
    phone text check (phone is null or char_length(phone) <= 60),
    address text check (address is null or char_length(address) <= 300),
    notes text check (notes is null or char_length(notes) <= 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (business_id, id)
  );
  create index if not exists suppliers_business_idx on public.suppliers (business_id, name);

  drop trigger if exists suppliers_updated_at on public.suppliers;
  create trigger suppliers_updated_at before update on public.suppliers
    for each row execute function public.set_updated_at();
  drop trigger if exists suppliers_keep_business on public.suppliers;
  create trigger suppliers_keep_business before update on public.suppliers
    for each row execute function public.prevent_business_change();

  alter table public.suppliers enable row level security;
  alter table public.suppliers force row level security;
  revoke all on public.suppliers from anon;
  grant select, insert, update, delete on public.suppliers to authenticated;

  drop policy if exists "members select" on public.suppliers;
  drop policy if exists "members insert" on public.suppliers;
  drop policy if exists "members update" on public.suppliers;
  drop policy if exists "owners delete" on public.suppliers;
  create policy "members select" on public.suppliers for select to authenticated
    using (business_id = (select public.current_business_id()));
  create policy "members insert" on public.suppliers for insert to authenticated
    with check (business_id = (select public.current_business_id()));
  create policy "members update" on public.suppliers for update to authenticated
    using (business_id = (select public.current_business_id()))
    with check (business_id = (select public.current_business_id()));
  create policy "owners delete" on public.suppliers for delete to authenticated
    using (business_id = (select public.current_business_id()) and (select public.my_business_role()) = 'owner');

  -- Collegamento dal lotto: stessa attività obbligatoria; se il fornitore sparisce il lotto resta.
  alter table public.purchase_lots add column if not exists supplier_id uuid;
  if not exists (select 1 from pg_constraint where conname = 'purchase_lots_supplier_fk') then
    alter table public.purchase_lots
      add constraint purchase_lots_supplier_fk
      foreign key (business_id, supplier_id) references public.suppliers (business_id, id)
      on delete set null (supplier_id);
  end if;
  create index if not exists purchase_lots_supplier_idx on public.purchase_lots (supplier_id);

  -- I nomi scritti a mano sui lotti diventano fornitori (uno per nome, per attività).
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'purchase_lots' and column_name = 'supplier_name') then
    insert into public.suppliers (business_id, name)
      select distinct l.business_id, trim(l.supplier_name)
        from public.purchase_lots l
       where l.supplier_name is not null and length(trim(l.supplier_name)) > 0
         and not exists (select 1 from public.suppliers s where s.business_id = l.business_id and s.name = trim(l.supplier_name));
    update public.purchase_lots l
       set supplier_id = s.id
      from public.suppliers s
     where s.business_id = l.business_id and s.name = trim(l.supplier_name) and l.supplier_id is null;
    alter table public.purchase_lots drop column supplier_name;
  end if;

  if (select count(*) from public.purchase_lots) <> v_lots then
    raise exception 'Verifica fallita: il numero di lotti è cambiato. Nessuna modifica applicata.';
  end if;
end
$migration$;
