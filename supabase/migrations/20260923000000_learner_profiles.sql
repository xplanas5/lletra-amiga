-- Lletra Amiga — Fase 2: perfils d'aprenent al núvol
--
-- Cada compte (persona adulta: família o professional) té N perfils d'aprenent.
-- Els perfils NO tenen correu ni dades identificatives: només un àlies, els
-- ajustos de lectura i el progrés, tal com els desa l'app al localStorage.
--
-- Com aplicar-ho: Supabase → SQL Editor → enganxa aquest fitxer → Run.

create table if not exists public.learner_profiles (
  owner      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 64),
  name       text        not null check (char_length(name) between 1 and 60),
  settings   jsonb       not null default '{}'::jsonb,
  progress   jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, id),
  -- Límit de mida per evitar abusos (el progrés real ocupa pocs kB).
  constraint learner_profiles_size check (pg_column_size(settings) + pg_column_size(progress) < 512000)
);

comment on table public.learner_profiles is
  'Perfils d''aprenent de Lletra Amiga. Sense dades identificatives: àlies, ajustos i progrés.';

-- updated_at sempre el fixa el servidor (serveix per resoldre conflictes entre dispositius).
create or replace function public.learner_profiles_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists learner_profiles_touch on public.learner_profiles;
create trigger learner_profiles_touch
  before insert or update on public.learner_profiles
  for each row execute function public.learner_profiles_touch();

-- Seguretat per files: cada compte només veu i modifica els seus perfils.
alter table public.learner_profiles enable row level security;

drop policy if exists "Propietari: llegeix" on public.learner_profiles;
create policy "Propietari: llegeix" on public.learner_profiles
  for select to authenticated
  using ((select auth.uid()) = owner);

drop policy if exists "Propietari: crea" on public.learner_profiles;
create policy "Propietari: crea" on public.learner_profiles
  for insert to authenticated
  with check ((select auth.uid()) = owner);

drop policy if exists "Propietari: modifica" on public.learner_profiles;
create policy "Propietari: modifica" on public.learner_profiles
  for update to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

drop policy if exists "Propietari: esborra" on public.learner_profiles;
create policy "Propietari: esborra" on public.learner_profiles
  for delete to authenticated
  using ((select auth.uid()) = owner);

-- Els visitants sense sessió no hi tenen cap accés.
revoke all on public.learner_profiles from anon;
grant select, insert, update, delete on public.learner_profiles to authenticated;
