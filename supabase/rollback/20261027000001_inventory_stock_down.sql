-- ROLLBACK della migrazione 20261027000001_inventory_stock.sql (torna alla giacenza assente).
-- Da eseguire a mano, solo se serve, PRIMA di un eventuale rollback dell'inventario.
begin;

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

drop table public.sale_materials;

commit;
