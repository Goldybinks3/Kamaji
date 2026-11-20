-- Jalon 6 : repas et courses, écrivables par tout le foyer.

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  served_on date not null,
  slot text not null default 'dinner' check (slot in ('lunch', 'dinner')),
  title text not null,
  notes text,
  cook_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, served_on, slot)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.meals enable row level security;
alter table public.shopping_items enable row level security;

create policy meals_member on public.meals
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy shopping_member on public.shopping_items
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
revoke all on public.meals from anon;
revoke all on public.shopping_items from anon;

alter publication supabase_realtime add table public.meals;
alter publication supabase_realtime add table public.shopping_items;
