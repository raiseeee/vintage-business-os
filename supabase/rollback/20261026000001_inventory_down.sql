-- ROLLBACK della migrazione 20261026000001_inventory.sql. Da eseguire a mano, solo se serve.
-- Elimina l'inventario e il costo materiali congelato sulle vendite (i profitti tornano senza materiali).
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
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.items set status = 'venduto' where id = p_item_id;
  if not found then
    raise exception 'Capo non trovato' using errcode = 'no_data_found';
  end if;

  insert into public.sales (
    item_id, channel, sold_at, price_cents, fees_cents,
    outbound_shipping_cents, extra_costs_cents, notes
  )
  values (
    p_item_id, p_channel, p_sold_at, p_price_cents, p_fees_cents,
    p_outbound_shipping_cents, p_extra_costs_cents, p_notes
  )
  on conflict (item_id) do update set
    channel = excluded.channel,
    sold_at = excluded.sold_at,
    price_cents = excluded.price_cents,
    fees_cents = excluded.fees_cents,
    outbound_shipping_cents = excluded.outbound_shipping_cents,
    extra_costs_cents = excluded.extra_costs_cents,
    notes = excluded.notes;
end;
$$;

alter table public.sales drop column materials_cost_cents;
drop table public.inventory_items;
drop type public.inventory_kind;

commit;
