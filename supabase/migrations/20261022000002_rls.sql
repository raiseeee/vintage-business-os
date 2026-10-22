-- Row Level Security: ogni utente vede e modifica solo le proprie righe.
-- Va applicata PRIMA di memorizzare dati reali.

do $$
declare
  t text;
begin
  foreach t in array array[
    'suppliers',
    'supplier_sources',
    'supplier_claims',
    'supplier_evaluations',
    'contact_log',
    'purchase_lots',
    'items',
    'item_photos',
    'sales'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- FORCE: le policy valgono anche per il proprietario della tabella.
    execute format('alter table public.%I force row level security', t);

    -- Nessun accesso per utenti non autenticati.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format($p$
      create policy "own rows select" on public.%I
        for select to authenticated
        using (user_id = (select auth.uid()))
    $p$, t);

    execute format($p$
      create policy "own rows insert" on public.%I
        for insert to authenticated
        with check (user_id = (select auth.uid()))
    $p$, t);

    execute format($p$
      create policy "own rows update" on public.%I
        for update to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $p$, t);

    execute format($p$
      create policy "own rows delete" on public.%I
        for delete to authenticated
        using (user_id = (select auth.uid()))
    $p$, t);
  end loop;
end;
$$;
