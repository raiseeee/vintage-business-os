-- Dove e quando un capo è stato messo in vendita (stato «pubblicato»).
-- Serve a precompilare il canale quando poi registri la vendita.
-- Nessun dato esistente cambia.

begin;

alter table public.items
  add column listing_channel text check (listing_channel is null or length(trim(listing_channel)) between 1 and 60),
  add column listed_at date;

commit;
