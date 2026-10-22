-- Funzioni per registrare e annullare una vendita in modo atomico:
-- vendita e stato del capo cambiano insieme oppure non cambia niente.
-- Sono SECURITY INVOKER: rispettano l'RLS e toccano solo i dati di chi le chiama.

-- Registra la vendita di un capo e lo segna come "venduto".
-- Se il capo ha già una vendita (es. è stato reso e poi rivenduto) la sostituisce.
create function public.record_sale(
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

-- Annulla una vendita registrata per errore: la elimina e rimette il capo "pronto per la vendita".
create function public.undo_sale(p_item_id uuid)
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

revoke all on function public.record_sale(uuid, text, date, bigint, bigint, bigint, bigint, text) from public, anon;
revoke all on function public.undo_sale(uuid) from public, anon;
grant execute on function public.record_sale(uuid, text, date, bigint, bigint, bigint, bigint, text) to authenticated;
grant execute on function public.undo_sale(uuid) to authenticated;
