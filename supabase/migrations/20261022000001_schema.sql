-- Vintage Business OS — schema iniziale
--
-- Convenzioni:
--  * Ogni tabella ha user_id (default auth.uid()): i dati sono separati per utente
--    e il modello è pronto per un futuro multiutente senza altre migrazioni.
--  * Importi in centesimi (bigint), mai decimali.
--  * Le chiavi esterne sono composite (user_id, id): una riga non può mai puntare
--    a dati di un altro utente, nemmeno aggirando l'RLS.
--  * Costi di acquisto/spedizione in entrata SOLO su purchase_lots;
--    commissioni/spedizione in uscita/extra SOLO su sales (nessun doppio conteggio).

-- ---------------------------------------------------------------- tipi

create type public.supplier_type as enum (
  'raccoglitore_diretto',
  'centro_selezione',
  'grossista_documentato',
  'rivenditore',
  'origine_non_verificata'
);

create type public.contact_status as enum (
  'da_contattare',
  'contattata',
  'in_attesa',
  'risposta_ricevuta',
  'campione_richiesto',
  'verificata',
  'scartata'
);

create type public.contact_channel as enum (
  'email', 'telefono', 'messaggio', 'visita', 'altro'
);

-- Livello di prova di un'informazione sul fornitore.
create type public.evidence_level as enum (
  'documentato',  -- supportato da una fonte registrata
  'dichiarato',   -- affermato dall'azienda, non verificato
  'ipotesi'       -- congettura personale
);

create type public.item_status as enum (
  'da_controllare',
  'da_fotografare',
  'pronto',
  'pubblicato',
  'venduto',
  'reso'
);

create type public.item_condition as enum (
  'ottima', 'buona', 'discreta', 'da_riparare'
);

-- ---------------------------------------------------------------- utilità

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- fornitori

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  name text not null check (length(trim(name)) > 0),
  website text,
  country text check (country ~ '^[A-Z]{2}$'),            -- codice ISO 3166-1 alpha-2
  languages text[] not null default '{}',
  stock_types text[] not null default '{}',
  brands text[] not null default '{}',

  supplier_type public.supplier_type not null default 'origine_non_verificata',

  min_order_qty integer check (min_order_qty >= 0),
  min_order_weight_kg numeric(10, 2) check (min_order_weight_kg >= 0),
  min_order_value_cents bigint check (min_order_value_cents >= 0),
  price_per_kg_cents bigint check (price_per_kg_cents >= 0),
  price_notes text,

  contact_name text,
  contact_email text,
  contact_phone text,

  -- CRM
  contact_status public.contact_status not null default 'da_contattare',
  next_action text,
  next_action_date date,
  last_contacted_at timestamptz,

  notes text,
  is_demo boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, id)
);

create index suppliers_user_idx on public.suppliers (user_id);
create index suppliers_country_idx on public.suppliers (user_id, country);
create index suppliers_status_idx on public.suppliers (user_id, contact_status);

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- Fonti che supportano le informazioni di un fornitore.
create table public.supplier_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplier_id uuid not null,

  url text,
  title text not null check (length(trim(title)) > 0),
  retrieved_at date,
  note text,

  created_at timestamptz not null default now(),

  unique (user_id, id),
  unique (user_id, supplier_id, id),
  foreign key (user_id, supplier_id)
    references public.suppliers (user_id, id) on delete cascade
);

create index supplier_sources_supplier_idx on public.supplier_sources (supplier_id);

-- Singole informazioni sul fornitore, ciascuna col suo livello di prova.
create table public.supplier_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplier_id uuid not null,

  field text not null
    check (field in ('tipo', 'provenienza', 'moq', 'prezzo', 'contatto', 'altro')),
  statement text not null check (length(trim(statement)) > 0),
  evidence_level public.evidence_level not null default 'ipotesi',
  source_id uuid,

  created_at timestamptz not null default now(),

  -- Un'informazione "documentata" deve avere una fonte.
  constraint documented_needs_source
    check (evidence_level <> 'documentato' or source_id is not null),

  foreign key (user_id, supplier_id)
    references public.suppliers (user_id, id) on delete cascade,
  -- La fonte deve appartenere allo stesso fornitore (se indicata).
  foreign key (user_id, supplier_id, source_id)
    references public.supplier_sources (user_id, supplier_id, id) on delete restrict
);

create index supplier_claims_supplier_idx on public.supplier_claims (supplier_id);

-- Storico delle valutazioni. Il punteggio attuale è l'ultima valutazione;
-- i pesi del punteggio totale vivono nel codice (src/lib), non nel database.
create table public.supplier_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplier_id uuid not null,

  proximity smallint not null check (proximity between 0 and 5),
  transparency smallint not null check (transparency between 0 and 5),
  min_order smallint not null check (min_order between 0 and 5),
  budget_fit smallint not null check (budget_fit between 0 and 5),
  vintage_interest smallint not null check (vintage_interest between 0 and 5),
  comment text,

  created_at timestamptz not null default now(),

  foreign key (user_id, supplier_id)
    references public.suppliers (user_id, id) on delete cascade
);

create index supplier_evaluations_supplier_idx
  on public.supplier_evaluations (supplier_id, created_at desc);

-- Registro dei contatti (CRM).
create table public.contact_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplier_id uuid not null,

  contacted_at timestamptz not null default now(),
  channel public.contact_channel not null default 'email',
  summary text not null check (length(trim(summary)) > 0),

  created_at timestamptz not null default now(),

  foreign key (user_id, supplier_id)
    references public.suppliers (user_id, id) on delete cascade
);

create index contact_log_supplier_idx on public.contact_log (supplier_id, contacted_at desc);

-- Un fornitore non può essere "diretto" (né "grossista documentato") senza
-- almeno un'informazione di provenienza documentata da una fonte.
create function public.supplier_has_documented_origin(p_supplier_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.supplier_claims c
    where c.supplier_id = p_supplier_id
      and c.field = 'provenienza'
      and c.evidence_level = 'documentato'
  );
$$;

create function public.enforce_supplier_type_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.supplier_type in ('raccoglitore_diretto', 'grossista_documentato')
     and not public.supplier_has_documented_origin(new.id) then
    raise exception
      'Il tipo "%" richiede almeno una informazione di provenienza documentata con fonte',
      new.supplier_type
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger suppliers_type_evidence
  before insert or update of supplier_type on public.suppliers
  for each row execute function public.enforce_supplier_type_evidence();

-- Impedisce di togliere o declassare l'ultima prova di provenienza di un
-- fornitore che dipende da essa.
create function public.protect_origin_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.supplier_type;
begin
  if old.field = 'provenienza' and old.evidence_level = 'documentato' then
    select supplier_type into v_type
    from public.suppliers where id = old.supplier_id;

    if v_type in ('raccoglitore_diretto', 'grossista_documentato')
       and not public.supplier_has_documented_origin(old.supplier_id) then
      raise exception
        'Impossibile rimuovere l''ultima prova di provenienza: il fornitore è di tipo "%". Cambia prima il tipo.',
        v_type
        using errcode = 'check_violation';
    end if;
  end if;
  return null;
end;
$$;

create trigger supplier_claims_protect_origin
  after update or delete on public.supplier_claims
  for each row execute function public.protect_origin_evidence();

-- ---------------------------------------------------------------- acquisti

create table public.purchase_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplier_id uuid not null,

  code text not null check (length(trim(code)) > 0),
  purchased_at date not null default current_date,

  purchase_cost_cents bigint not null check (purchase_cost_cents >= 0),
  inbound_shipping_cents bigint not null default 0 check (inbound_shipping_cents >= 0),
  other_costs_cents bigint not null default 0 check (other_costs_cents >= 0),

  quantity integer not null check (quantity > 0),
  weight_kg numeric(10, 2) check (weight_kg >= 0),
  notes text,
  is_demo boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, id),
  unique (user_id, code),
  -- Non si cancella un fornitore che ha acquisti registrati.
  foreign key (user_id, supplier_id)
    references public.suppliers (user_id, id) on delete restrict
);

create index purchase_lots_supplier_idx on public.purchase_lots (supplier_id);

create trigger purchase_lots_updated_at
  before update on public.purchase_lots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- capi

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lot_id uuid not null,

  code text not null check (length(trim(code)) > 0),
  brand text,
  category text,
  size text,
  condition public.item_condition,
  status public.item_status not null default 'da_controllare',
  expected_price_cents bigint check (expected_price_cents >= 0),
  notes text,
  is_demo boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, id),
  unique (user_id, code),
  -- Non si cancella un lotto che contiene capi.
  foreign key (user_id, lot_id)
    references public.purchase_lots (user_id, id) on delete restrict
);

create index items_lot_idx on public.items (lot_id);
create index items_status_idx on public.items (user_id, status);

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,

  -- Percorso nel bucket "item-photos": <user_id>/<item_id>/<file>
  storage_path text not null,
  position smallint not null default 0 check (position >= 0),

  created_at timestamptz not null default now(),

  unique (user_id, storage_path),
  foreign key (user_id, item_id)
    references public.items (user_id, id) on delete cascade
);

create index item_photos_item_idx on public.item_photos (item_id, position);

-- ---------------------------------------------------------------- vendite

-- Una vendita per capo. Qui vivono SOLO i costi della vendita
-- (commissioni, spedizione al cliente, extra): i costi di acquisto stanno sul lotto.
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,

  channel text not null check (length(trim(channel)) > 0),
  sold_at date not null default current_date,

  price_cents bigint not null check (price_cents >= 0),
  fees_cents bigint not null default 0 check (fees_cents >= 0),
  outbound_shipping_cents bigint not null default 0 check (outbound_shipping_cents >= 0),
  extra_costs_cents bigint not null default 0 check (extra_costs_cents >= 0),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, id),
  unique (item_id),
  -- Non si cancella un capo che ha una vendita registrata.
  foreign key (user_id, item_id)
    references public.items (user_id, id) on delete restrict
);

create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();
