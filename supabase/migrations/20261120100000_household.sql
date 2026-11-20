-- Jalon 2 : foyer et membres.
-- À coller dans l’éditeur SQL Supabase, avant les fichiers suivants.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Paris',
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null,
  avatar_key text not null default 'cercle',
  phone text,
  energy text not null default 'ok' check (energy in ('low', 'ok', 'high')),
  energy_set_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid()
$$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Tu as déjà un foyer';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.households (name, invite_code)
  values (trim(p_name), v_code)
  returning id into v_id;

  insert into public.profiles (id, household_id, display_name)
  values (auth.uid(), v_id, trim(p_display_name));
  return v_id;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_size integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Tu as déjà un foyer';
  end if;

  select id into v_id
  from public.households
  where invite_code = upper(trim(p_code));
  if v_id is null then
    raise exception 'Code inconnu';
  end if;

  select count(*) into v_size from public.profiles where household_id = v_id;
  if v_size >= 8 then
    raise exception 'Foyer complet';
  end if;

  insert into public.profiles (id, household_id, display_name)
  values (auth.uid(), v_id, trim(p_display_name));
  return v_id;
end;
$$;

create or replace function public.protect_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.household_id <> old.household_id then
    raise exception 'Foyer figé';
  end if;
  return new;
end;
$$;

create trigger profiles_protect
before update on public.profiles
for each row execute function public.protect_profile();

revoke all on function public.current_household_id() from public, anon;
revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.current_household_id() to authenticated;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;

create policy households_select on public.households
for select to authenticated
using (id = public.current_household_id());

create policy profiles_select on public.profiles
for select to authenticated
using (household_id = public.current_household_id());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and household_id = public.current_household_id());

grant select on public.households to authenticated;
grant select, update on public.profiles to authenticated;
revoke all on public.households from anon;
revoke all on public.profiles from anon;
