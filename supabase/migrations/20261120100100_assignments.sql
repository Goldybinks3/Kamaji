-- Jalon 3 et 4 : tâches, demandes, acceptation.
-- Les écritures passent par les fonctions. Le client ne fait que lire.

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  template_id uuid,
  title text not null,
  details text,
  kind text not null check (kind in ('rotation', 'request', 'offer', 'paid')),
  status text not null default 'open'
    check (status in ('open', 'accepted', 'done', 'missed', 'cancelled')),
  assignee_id uuid references public.profiles (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  due_on date not null,
  due_time time,
  price_cents integer check (price_cents is null or price_cents >= 0),
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (requested_by is null or assignee_id is null or requested_by <> assignee_id),
  check (kind <> 'paid' or price_cents is not null),
  check (price_cents is null or kind = 'paid')
);

create index assignments_household_due_idx
  on public.assignments (household_id, due_on, status);

create index assignments_assignee_idx
  on public.assignments (assignee_id, status, due_on);

alter table public.assignments enable row level security;

create policy assignments_select on public.assignments
for select to authenticated
using (household_id = public.current_household_id());

grant select on public.assignments to authenticated;
revoke all on public.assignments from anon;

create or replace function public.create_request(
  p_title text,
  p_assignee uuid,
  p_due_on date,
  p_due_time time,
  p_price_cents integer
)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_tz text;
  v_kind text;
  v_row public.assignments;
begin
  select p.household_id, h.timezone into v_household, v_tz
  from public.profiles p
  join public.households h on h.id = p.household_id
  where p.id = auth.uid();

  if v_household is null then
    raise exception 'Pas de foyer';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'Choisis une tâche';
  end if;
  if p_assignee = auth.uid() then
    raise exception 'Tu ne peux pas te donner une tâche';
  end if;
  if p_assignee is not null and not exists (
    select 1 from public.profiles
    where id = p_assignee and household_id = v_household
  ) then
    raise exception 'Cette personne n’est pas du foyer';
  end if;
  if p_due_on < (timezone(v_tz, now()))::date then
    raise exception 'Date passée';
  end if;

  if p_price_cents is not null then
    v_kind := 'paid';
  elsif p_assignee is null then
    v_kind := 'offer';
  else
    v_kind := 'request';
  end if;

  insert into public.assignments (
    household_id, title, kind, status, assignee_id, requested_by,
    due_on, due_time, price_cents
  ) values (
    v_household, trim(p_title), v_kind, 'open', p_assignee, auth.uid(),
    p_due_on, p_due_time, p_price_cents
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.accept_assignment(p_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_row public.assignments;
begin
  v_household := public.current_household_id();

  select * into v_row
  from public.assignments
  where id = p_id and household_id = v_household
  for update;

  if not found then
    raise exception 'Tâche introuvable';
  end if;
  if v_row.status <> 'open' then
    raise exception 'Déjà prise';
  end if;
  if v_row.requested_by = auth.uid() then
    raise exception 'Tu ne peux pas prendre ta propre demande';
  end if;
  if v_row.assignee_id is not null and v_row.assignee_id <> auth.uid() then
    raise exception 'Cette demande vise quelqu’un d’autre';
  end if;

  update public.assignments
  set assignee_id = auth.uid(), status = 'accepted'
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_request(text, uuid, date, time, integer) from public, anon;
revoke all on function public.accept_assignment(uuid) from public, anon;
grant execute on function public.create_request(text, uuid, date, time, integer) to authenticated;
grant execute on function public.accept_assignment(uuid) to authenticated;

alter publication supabase_realtime add table public.assignments;
alter publication supabase_realtime add table public.profiles;
