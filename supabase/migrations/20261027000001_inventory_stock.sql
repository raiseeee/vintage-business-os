-- Giacenza dei materiali: quanti ne restano (es. 99 su 100).
-- Ogni vendita registra quanti pezzi dei materiali «in uso» ha consumato (sale_materials).
-- Rimasti = quantità acquistata − somma dei consumi. Annullare una vendita ripristina la giacenza.
-- Le vendite già registrate prima di questa migrazione non hanno consumi: la giacenza parte piena.
-- Chi può: i membri leggono, creano e correggono; i consumi si eliminano a cascata con la vendita.

begin;

create table public.sale_materials (
  sale_id uuid not null references public.sales (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  business_id uuid not null default public.current_business_id() references public.businesses (id) on delete restrict,
  qty numeric(10, 3) not null check (qty > 0),
  primary key (sale_id, inventory_item_id)
);

create index sale_materials_item_idx on public.sale_materials (inventory_item_id);
create index sale_materials_business_idx on public.sale_materials (business_id);

alter table public.sale_materials enable row level security;
alter table public.sale_materials force row level security;
revoke all on public.sale_materials from anon;
grant select, insert, update, delete on public.sale_materials to authenticated;

create policy "members select" on public.sale_materials for select to authenticated
  using (business_id = (select public.current_business_id()));
create policy "members insert" on public.sale_materials for insert to authenticated
  with check (business_id = (select public.current_business_id()));
create policy "members update" on public.sale_materials for update to authenticated
  using (business_id = (select public.current_business_id()))
  with check (business_id = (select public.current_business_id()));
-- Registrare di nuovo una vendita (capo reso e rivenduto) ricalcola i consumi: serve poter cancellare le righe.
create policy "members delete" on public.sale_materials for delete to authenticated
  using (business_id = (select public.current_business_id()));

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
  v_sale uuid;
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
    notes = excluded.notes
  returning id into v_sale;

  -- Consumo dei materiali di QUESTA vendita (serve per sapere quanti ne restano).
  -- Se la vendita viene registrata di nuovo (capo reso e rivenduto) il consumo si ricalcola;
  -- se la vendita viene annullata, le righe spariscono a cascata e la giacenza torna com'era.
  delete from public.sale_materials where sale_id = v_sale;
  insert into public.sale_materials (sale_id, inventory_item_id, qty)
    select v_sale, i.id, i.per_item_qty
    from public.inventory_items i
    where i.kind = 'materiale' and i.in_use and i.per_item_qty > 0;
end;
$$;

commit;
