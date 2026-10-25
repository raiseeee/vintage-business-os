-- ROLLBACK di 20261028000001_item_listing.sql: elimina canale e data di pubblicazione dei capi.
begin;
alter table public.items drop column listing_channel, drop column listed_at;
commit;
