-- Rimuove fornitori, CRM, ricerche e dati demo. IRREVERSIBILE: fai prima un backup
-- (Backup completo JSON dall'app + pg_dump). Non esiste uno script di rollback:
-- per tornare indietro si ripristina il backup.
-- Il nome del fornitore resta solo come testo facoltativo sul lotto (purchase_lots.supplier_name).
begin;

-- Conteggi dei dati veri (non demo) prima della pulizia.
create table public._remove_suppliers_check as
select
  (select count(*) from public.purchase_lots where not is_demo) as lots,
  (select count(*) from public.items where not is_demo) as items,
  (select count(*) from public.sales s join public.items i on i.id = s.item_id where not i.is_demo) as sales;

-- 1) Il nome del fornitore passa sul lotto.
alter table public.purchase_lots
  add column supplier_name text check (supplier_name is null or char_length(supplier_name) <= 120);
update public.purchase_lots l
   set supplier_name = left(s.name, 120)
  from public.suppliers s
 where s.id = l.supplier_id;

-- 2) Elimina i dati demo (vendite → foto → capi → lotti).
delete from public.sales where item_id in (select id from public.items where is_demo);
delete from public.item_photos where item_id in (select id from public.items where is_demo);
delete from public.items where is_demo;
delete from public.purchase_lots where is_demo;

-- 3) Funzioni.
drop function if exists public.load_demo_data();
drop function if exists public.clear_demo_data();

-- 4) Colonne e tabelle.
alter table public.purchase_lots drop column supplier_id;
alter table public.purchase_lots drop column is_demo;
alter table public.items drop column is_demo;

drop table public.search_results;
drop table public.search_runs;
drop table public.contact_log;
drop table public.supplier_evaluations;
drop table public.supplier_claims;
drop table public.supplier_sources;
drop table public.suppliers;

drop function if exists public.protect_origin_evidence();
drop function if exists public.enforce_supplier_type_evidence();
drop function if exists public.supplier_has_documented_origin(uuid);

drop type public.supplier_type;
drop type public.contact_status;
drop type public.contact_channel;
drop type public.evidence_level;

-- 5) Verifica: nessun dato vero perso.
do $$
declare c record;
begin
  select * into c from public._remove_suppliers_check;
  if (select count(*) from public.purchase_lots) <> c.lots
     or (select count(*) from public.items) <> c.items
     or (select count(*) from public.sales) <> c.sales then
    raise exception 'Verifica fallita: i conteggi di lotti, capi o vendite sono cambiati. Nessuna modifica applicata.';
  end if;
end $$;
drop table public._remove_suppliers_check;

commit;
