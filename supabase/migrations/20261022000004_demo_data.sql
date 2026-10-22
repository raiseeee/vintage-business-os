-- Dati demo, SEMPRE identificabili come tali:
--  * nomi che iniziano con "[DEMO]" e codici che iniziano con "DEMO-";
--  * is_demo = true;
--  * domini riservati example.com (nessuna azienda reale);
--  * nessuna marca reale.
-- Non vengono caricati automaticamente: l'utente autenticato li carica o li
-- rimuove esplicitamente chiamando load_demo_data() / clear_demo_data().
-- Le funzioni sono SECURITY INVOKER: rispettano l'RLS e toccano solo i dati
-- di chi le chiama.

create function public.load_demo_data()
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

create function public.clear_demo_data()
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

revoke all on function public.load_demo_data() from public, anon;
revoke all on function public.clear_demo_data() from public, anon;
grant execute on function public.load_demo_data() to authenticated;
grant execute on function public.clear_demo_data() to authenticated;
