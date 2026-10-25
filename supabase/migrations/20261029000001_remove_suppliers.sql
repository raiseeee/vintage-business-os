-- Rimuove fornitori, CRM, ricerche e dati demo. IRREVERSIBILE: fai prima un backup
-- (Backup completo JSON dall'app + pg_dump). Non esiste uno script di rollback:
-- per tornare indietro si ripristina il backup.
-- Il nome del fornitore resta solo come testo facoltativo sul lotto (purchase_lots.supplier_name).
-- Tutto in un unico blocco (atomico, nessuna tabella di appoggio) e rilanciabile senza danni.
do $migration$
declare
  v_lots bigint;
  v_items bigint;
  v_sales bigint;
begin
  -- Conteggi dei dati veri (non demo) prima della pulizia.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'items' and column_name = 'is_demo') then
    select count(*) into v_lots from public.purchase_lots where not is_demo;
    select count(*) into v_items from public.items where not is_demo;
    select count(*) into v_sales from public.sales s join public.items i on i.id = s.item_id where not i.is_demo;
  else
    select count(*) into v_lots from public.purchase_lots;
    select count(*) into v_items from public.items;
    select count(*) into v_sales from public.sales;
  end if;

  -- 1) Il nome del fornitore passa sul lotto.
  alter table public.purchase_lots
    add column if not exists supplier_name text check (supplier_name is null or char_length(supplier_name) <= 120);
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'purchase_lots' and column_name = 'supplier_id')
     and to_regclass('public.suppliers') is not null then
    update public.purchase_lots l
       set supplier_name = left(s.name, 120)
      from public.suppliers s
     where s.id = l.supplier_id;
  end if;

  -- 2) Elimina i dati demo (vendite → foto → capi → lotti).
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'items' and column_name = 'is_demo') then
    delete from public.sales where item_id in (select id from public.items where is_demo);
    delete from public.item_photos where item_id in (select id from public.items where is_demo);
    delete from public.items where is_demo;
    delete from public.purchase_lots where is_demo;
  end if;

  -- 3) Funzioni.
  drop function if exists public.load_demo_data();
  drop function if exists public.clear_demo_data();

  -- 4) Colonne e tabelle.
  alter table public.purchase_lots drop column if exists supplier_id;
  alter table public.purchase_lots drop column if exists is_demo;
  alter table public.items drop column if exists is_demo;

  drop table if exists public.search_results;
  drop table if exists public.search_runs;
  drop table if exists public.contact_log;
  drop table if exists public.supplier_evaluations;
  drop table if exists public.supplier_claims;
  drop table if exists public.supplier_sources;
  drop table if exists public.suppliers;

  drop function if exists public.protect_origin_evidence();
  drop function if exists public.enforce_supplier_type_evidence();
  drop function if exists public.supplier_has_documented_origin(uuid);

  drop type if exists public.supplier_type;
  drop type if exists public.contact_status;
  drop type if exists public.contact_channel;
  drop type if exists public.evidence_level;

  -- 5) Verifica: nessun dato vero perso (altrimenti si annulla tutto).
  if (select count(*) from public.purchase_lots) <> v_lots
     or (select count(*) from public.items) <> v_items
     or (select count(*) from public.sales) <> v_sales then
    raise exception 'Verifica fallita: i conteggi di lotti, capi o vendite sono cambiati. Nessuna modifica applicata.';
  end if;
end
$migration$;
