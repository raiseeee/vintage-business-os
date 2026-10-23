-- Ricerche di fornitori salvate: ogni ricerca (search_runs) e le aziende trovate (search_results).
-- I risultati sono SUGGERIMENTI: non sono fornitori finché l'utente non li aggiunge.

create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  term text not null default '',
  product text not null default '',
  area text not null,
  box_types text[] not null default '{}',
  depth text not null check (depth in ('rapida', 'standard', 'approfondita')),
  provider text not null,
  queries text[] not null default '{}',
  queries_failed integer not null default 0 check (queries_failed >= 0),
  result_count integer not null default 0 check (result_count >= 0),

  created_at timestamptz not null default now(),

  unique (user_id, id)
);

create index search_runs_user_created_idx on public.search_runs (user_id, created_at desc);

create table public.search_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid not null,

  domain text not null check (length(trim(domain)) > 0),
  name text not null check (length(trim(name)) > 0),
  url text not null,
  root_url text not null,
  country text check (country ~ '^[A-Z]{2}$'),
  title text not null default '',
  snippet text not null default '',
  likelihood text not null check (likelihood in ('monte', 'incerto', 'rivenditore')),
  reasons text[] not null default '{}',
  score integer not null default 0,

  created_at timestamptz not null default now(),

  -- Una sola riga per sito in ogni ricerca.
  unique (user_id, run_id, domain),
  foreign key (user_id, run_id)
    references public.search_runs (user_id, id) on delete cascade
);

create index search_results_run_idx on public.search_results (run_id);
create index search_results_domain_idx on public.search_results (user_id, domain);

-- RLS: stesso schema delle altre tabelle.
do $$
declare
  t text;
begin
  foreach t in array array['search_runs', 'search_results']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format($p$create policy "own rows select" on public.%I
      for select to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own rows insert" on public.%I
      for insert to authenticated with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own rows update" on public.%I
      for update to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own rows delete" on public.%I
      for delete to authenticated using (user_id = (select auth.uid()))$p$, t);
  end loop;
end;
$$;
