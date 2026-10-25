-- Inventario: materiali di consumo (costo per capo) e attrezzature (investimenti).
--
--  * materiale  → costo unitario = costo totale / quantità; se «in uso», il costo per capo
--                 (costo unitario × quantità per capo) viene CONGELATO su ogni vendita (sales.materials_cost_cents).
--  * attrezzatura → non entra nel costo dei capi: è un investimento da recuperare (mostrato nelle statistiche).
--  * Lavaggio e costi del singolo lotto restano negli «altri costi» del lotto: non vanno qui (doppio conteggio).
--
-- Le vendite già registrate restano a 0 materiali (non erano stati congelati allora).
-- Chi può: tutti i membri leggono, creano e modificano; eliminare solo i titolari.

begin;

create type public.inventory_kind as enum ('materiale', 'attrezzatura');

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default public.current_business_id() references public.businesses (id) on delete restrict,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,

  kind public.inventory_kind not null,
  name text not null check (length(trim(name)) > 0),
  total_cost_cents bigint not null check (total_cost_cents >= 0),
  quantity integer not null default 1 check (quantity > 0),
  -- Solo materiali: quante unità usa un capo (es. 1 sacchetto). Per le attrezzature resta 0.
  per_item_qty numeric(10, 3) not null default 0 check (per_item_qty >= 0),
  -- Solo materiali: se conta nel costo per capo delle nuove vendite (spegni la vecchia confezione quando ne compri un'altra).
  in_use boolean not null default false,
  purchased_at date not null default current_date,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (kind = 'materiale' or (per_item_qty = 0 and not in_use))
);

create index inventory_items_business_idx on public.inventory_items (business_id);

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger inventory_items_keep_business
  before update on public.inventory_items
  for each row execute function public.prevent_business_change();

alter table public.inventory_items enable row level security;
alter table public.inventory_items force row level security;
revoke all on public.inventory_items from anon;
grant select, insert, update, delete on public.inventory_items to authenticated;

create policy "members select" on public.inventory_items for select to authenticated
  using (business_id = (select public.current_business_id()));
create policy "members insert" on public.inventory_items for insert to authenticated
  with check (business_id = (select public.current_business_id()));
create policy "members update" on public.inventory_items for update to authenticated
  using (business_id = (select public.current_business_id()))
  with check (business_id = (select public.current_business_id()));
create policy "owners delete" on public.inventory_items for delete to authenticated
  using (business_id = (select public.current_business_id()) and (select public.my_business_role()) = 'owner');

alter table public.sales add column materials_cost_cents bigint not null default 0 check (materials_cost_cents >= 0);

create or replace function public.record_sale(
  p_item_id uuid,
  p_channel text,
  p_sold_at date,
  p_price_cents bigint,
  p_fees_cents bigint,
  p_outbound_shipping_cents bigint,
  p_extra_costs_cents bigint,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_materials bigint;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.items set status = 'venduto' where id = p_item_id;
  if not found then
    raise exception 'Capo non trovato' using errcode = 'no_data_found';
  end if;

  -- Costo dei materiali per capo (sacchetti, scatole…) CONGELATO al momento della vendita:
  -- cambiare dopo i prezzi dell'inventario non modifica i profitti già registrati.
  select coalesce(round(sum(i.total_cost_cents::numeric / i.quantity * i.per_item_qty)), 0)::bigint
    into v_materials
    from public.inventory_items i
    where i.kind = 'materiale' and i.in_use;

  insert into public.sales (
    item_id, channel, sold_at, price_cents, fees_cents,
    outbound_shipping_cents, extra_costs_cents, materials_cost_cents, notes
  )
  values (
    p_item_id, p_channel, p_sold_at, p_price_cents, p_fees_cents,
    p_outbound_shipping_cents, p_extra_costs_cents, v_materials, p_notes
  )
  on conflict (item_id) do update set
    channel = excluded.channel,
    sold_at = excluded.sold_at,
    price_cents = excluded.price_cents,
    fees_cents = excluded.fees_cents,
    outbound_shipping_cents = excluded.outbound_shipping_cents,
    extra_costs_cents = excluded.extra_costs_cents,
    materials_cost_cents = excluded.materials_cost_cents,
    notes = excluded.notes;
end;
$$;

commit;
