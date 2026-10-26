-- ROLLBACK di 20261030000001_suppliers_simple.sql. Da eseguire a mano, solo se serve.
-- Rimette il nome del fornitore come testo sul lotto ed elimina la tabella dei fornitori
-- (email, telefono, indirizzo e note dei fornitori andrebbero persi: fai prima un backup).
do $rollback$
begin
  alter table public.purchase_lots add column if not exists supplier_name text
    check (supplier_name is null or char_length(supplier_name) <= 120);
  update public.purchase_lots l set supplier_name = left(s.name, 120)
    from public.suppliers s where s.id = l.supplier_id;
  alter table public.purchase_lots drop column if exists supplier_id;
  drop table if exists public.suppliers;
end
$rollback$;
