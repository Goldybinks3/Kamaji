-- Jalon 7 : mercis, notifications, passage de minuit.
-- Les mercis restent visibles seulement pour les deux personnes concernées.

create table public.thanks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_profile_id uuid not null references public.profiles (id) on delete cascade,
  to_profile_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check (from_profile_id <> to_profile_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.thanks enable row level security;
alter table public.push_subscriptions enable row level security;

create policy thanks_select on public.thanks
for select to authenticated
using (
  household_id = public.current_household_id()
  and (from_profile_id = auth.uid() or to_profile_id = auth.uid())
);

create policy thanks_insert on public.thanks
for insert to authenticated
with check (
  household_id = public.current_household_id()
  and from_profile_id = auth.uid()
);

create policy push_self on public.push_subscriptions
for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

grant select, insert on public.thanks to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.thanks from anon;
revoke all on public.push_subscriptions from anon;

create or replace function public.close_day(p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_count integer;
begin
  v_household := public.current_household_id();
  if v_household is null then
    raise exception 'Pas de foyer';
  end if;

  update public.assignments
  set status = 'missed'
  where household_id = v_household
    and due_on = p_day
    and status in ('open', 'accepted');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.close_day(date) from public, anon;
grant execute on function public.close_day(date) to authenticated;
