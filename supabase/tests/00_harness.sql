-- SOLO PER I TEST LOCALI. Non è una migrazione e non va eseguito su Supabase.
-- Simula le parti di Supabase da cui dipendono le migrazioni: ruoli, schema auth
-- (con auth.uid()) e schema storage.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

create schema auth;
create table auth.users (id uuid primary key, email text);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Come la funzione reale, ma i claim arrivano dalle due impostazioni usate dai test.
create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
    'email', nullif(current_setting('request.jwt.claim.email', true), ''))
$$;

create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;

-- Come la funzione reale: restituisce le cartelle del percorso, senza il nome del file.
create function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;

grant usage on schema auth, storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

-- Helper dei test: esegue uno statement e controlla che fallisca con lo sqlstate atteso.
create schema test;
grant usage on schema test to anon, authenticated;

create function test.expect_error(p_sql text, p_sqlstate text, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then
      raise notice 'OK    %', p_label;
      return;
    end if;
    raise exception 'FAIL  %: atteso %, ottenuto % (%)', p_label, p_sqlstate, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL  %: lo statement doveva fallire', p_label;
end;
$$;

create function test.expect_equal(p_actual bigint, p_expected bigint, p_label text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL  %: atteso %, ottenuto %', p_label, p_expected, p_actual;
  end if;
  raise notice 'OK    %', p_label;
end;
$$;

create function test.expect_numeric(p_actual numeric, p_expected numeric, p_label text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL  %: atteso %, ottenuto %', p_label, p_expected, p_actual;
  end if;
  raise notice 'OK    %', p_label;
end;
$$;

grant execute on all functions in schema test to anon, authenticated;
