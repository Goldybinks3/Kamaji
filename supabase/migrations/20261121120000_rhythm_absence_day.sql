-- Rythme midi/soir, vacances, absences, et fin de journée de bonne foi.
-- Une tâche encore ouverte après sa date est considérée faite.
-- Seul « Pas faite » la marque manquée.

alter table public.assignments
  add column if not exists slot text,
  add column if not exists assumed boolean not null default false;

alter table public.assignments
  drop constraint if exists assignments_slot_check;

alter table public.assignments
  add constraint assignments_slot_check
  check (slot is null or slot in ('lunch', 'dinner'));

alter table public.chore_templates
  add column if not exists slot text;

alter table public.chore_templates
  drop constraint if exists chore_templates_slot_check;

alter table public.chore_templates
  add constraint chore_templates_slot_check
  check (slot is null or slot in ('lunch', 'dinner'));

create or replace function public.valid_meal_slots(p_slots text[])
returns boolean
language plpgsql
immutable
as $$
declare
  s text;
  seen text[] := '{}';
begin
  if p_slots is null or cardinality(p_slots) < 1 or cardinality(p_slots) > 2 then
    return false;
  end if;
  foreach s in array p_slots loop
    if s not in ('lunch', 'dinner') or s = any (seen) then
      return false;
    end if;
    seen := seen || s;
  end loop;
  return true;
end;
$$;

create table if not exists public.household_rhythms (
  household_id uuid primary key references public.households (id) on delete cascade,
  weekday_slots text[] not null default '{dinner}',
  weekend_slots text[] not null default '{lunch,dinner}',
  constraint household_rhythms_weekday_check check (public.valid_meal_slots(weekday_slots)),
  constraint household_rhythms_weekend_check check (public.valid_meal_slots(weekend_slots))
);

create table if not exists public.calendar_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  slots text[] not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (length(trim(label)) > 0),
  check (public.valid_meal_slots(slots))
);

create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists calendar_periods_span_idx
  on public.calendar_periods (household_id, starts_on, ends_on);

create index if not exists absences_span_idx
  on public.absences (household_id, profile_id, starts_on, ends_on);

create table if not exists public.pings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_profile_id uuid not null references public.profiles (id) on delete cascade,
  to_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_profile_id <> to_profile_id),
  check (length(trim(body)) between 1 and 140)
);

create index if not exists pings_inbox_idx
  on public.pings (to_profile_id, created_at desc)
  where read_at is null;

create or replace function public.seed_household_rhythm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_rhythms (household_id)
  values (new.id)
  on conflict (household_id) do nothing;
  return new;
end;
$$;

drop trigger if exists households_seed_rhythm on public.households;

create trigger households_seed_rhythm
after insert on public.households
for each row
execute function public.seed_household_rhythm();

insert into public.household_rhythms (household_id)
select id from public.households
on conflict (household_id) do nothing;

alter table public.household_rhythms enable row level security;
alter table public.calendar_periods enable row level security;
alter table public.absences enable row level security;
alter table public.pings enable row level security;

drop policy if exists rhythms_member on public.household_rhythms;
create policy rhythms_member on public.household_rhythms
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

drop policy if exists periods_member on public.calendar_periods;
create policy periods_member on public.calendar_periods
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

drop policy if exists absences_member on public.absences;
create policy absences_member on public.absences
for all to authenticated
using (household_id = public.current_household_id())
with check (
  household_id = public.current_household_id()
  and exists (
    select 1 from public.profiles
    where id = profile_id and household_id = public.current_household_id()
  )
);

drop policy if exists pings_select on public.pings;
create policy pings_select on public.pings
for select to authenticated
using (
  household_id = public.current_household_id()
  and (from_profile_id = auth.uid() or to_profile_id = auth.uid())
);

drop policy if exists pings_insert on public.pings;
create policy pings_insert on public.pings
for insert to authenticated
with check (
  household_id = public.current_household_id()
  and from_profile_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = to_profile_id and household_id = public.current_household_id()
  )
);

drop policy if exists pings_read on public.pings;
create policy pings_read on public.pings
for update to authenticated
using (to_profile_id = auth.uid())
with check (to_profile_id = auth.uid());

grant select, update on public.household_rhythms to authenticated;
grant select, insert, update, delete on public.calendar_periods to authenticated;
grant select, insert, update, delete on public.absences to authenticated;
grant select, insert, update on public.pings to authenticated;
revoke all on public.household_rhythms from anon;
revoke all on public.calendar_periods from anon;
revoke all on public.absences from anon;
revoke all on public.pings from anon;

create or replace function public.open_slots(p_day date)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_slots text[];
begin
  v_household := public.current_household_id();
  if v_household is null then
    raise exception 'Pas de foyer';
  end if;

  select slots into v_slots
  from public.calendar_periods
  where household_id = v_household
    and p_day between starts_on and ends_on
  order by starts_on desc
  limit 1;

  if v_slots is not null then
    return v_slots;
  end if;

  select case
    when extract(isodow from p_day) in (6, 7) then weekend_slots
    else weekday_slots
  end into v_slots
  from public.household_rhythms
  where household_id = v_household;

  return coalesce(v_slots, array['dinner']::text[]);
end;
$$;

revoke all on function public.open_slots(date) from public, anon;
grant execute on function public.open_slots(date) to authenticated;

drop function if exists public.create_request(text, uuid, date, time, integer);

create or replace function public.create_request(
  p_title text,
  p_assignee uuid,
  p_due_on date,
  p_due_time time,
  p_price_cents integer,
  p_slot text default null
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
  if p_slot is not null and p_slot not in ('lunch', 'dinner') then
    raise exception 'Moment inconnu';
  end if;
  if p_slot is not null and not (p_slot = any (public.open_slots(p_due_on))) then
    raise exception 'Ce moment est fermé ce jour-là';
  end if;
  if p_assignee is not null and exists (
    select 1 from public.absences
    where profile_id = p_assignee
      and household_id = v_household
      and p_due_on between starts_on and ends_on
  ) then
    raise exception 'Cette personne est absente ce jour-là';
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
    due_on, due_time, price_cents, slot, assumed
  ) values (
    v_household, trim(p_title), v_kind, 'open', p_assignee, auth.uid(),
    p_due_on, p_due_time, p_price_cents, p_slot, false
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_request(text, uuid, date, time, integer, text) from public, anon;
grant execute on function public.create_request(text, uuid, date, time, integer, text) to authenticated;

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
  if exists (
    select 1 from public.absences
    where profile_id = auth.uid()
      and household_id = v_household
      and v_row.due_on between starts_on and ends_on
  ) then
    raise exception 'Tu es absent ce jour-là';
  end if;

  update public.assignments
  set assignee_id = auth.uid(), status = 'accepted', assumed = false
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.complete_assignment(p_id uuid)
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
  if v_row.status <> 'accepted' or v_row.assignee_id <> auth.uid() then
    raise exception 'Cette tâche n’est pas à toi';
  end if;

  update public.assignments
  set status = 'done', assumed = false, completed_by = auth.uid(), completed_at = now()
  where id = p_id
  returning * into v_row;

  if v_row.kind = 'offer' then
    insert into public.exemptions (household_id, profile_id, source_assignment_id)
    values (v_household, auth.uid(), p_id);
  end if;

  return v_row;
end;
$$;

drop function if exists public.pick_member(uuid, text, date, uuid);

create or replace function public.pick_member(
  p_household uuid,
  p_effort text,
  p_week_start date,
  p_exclude uuid default null,
  p_on date default null
)
returns uuid
language sql
volatile
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.household_id = p_household
    and (p_effort <> 'heavy' or p.energy <> 'low')
    and (p_exclude is null or p.id <> p_exclude)
    and (
      p_on is null
      or not exists (
        select 1 from public.absences a
        where a.profile_id = p.id
          and a.household_id = p.household_id
          and p_on between a.starts_on and a.ends_on
      )
    )
  order by
    (
      select count(*) from public.assignments a
      where a.assignee_id = p.id
        and a.kind = 'rotation'
        and a.due_on >= p_week_start
        and a.due_on < p_week_start + 7
    ),
    case when p.energy = 'low' then 1 else 0 end,
    (
      select count(*) from public.assignments a
      where a.assignee_id = p.id
        and a.kind = 'rotation'
        and a.status = 'done'
        and a.due_on >= p_week_start - 28
        and a.due_on < p_week_start
    ),
    random()
  limit 1
$$;

create or replace function public.generate_week(p_week_start date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_count integer := 0;
  r record;
  v_primary uuid;
  v_fallback uuid;
  v_exempt uuid;
begin
  v_household := public.current_household_id();
  if v_household is null then
    raise exception 'Pas de foyer';
  end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'La semaine commence un lundi';
  end if;
  if exists (
    select 1 from public.assignments
    where household_id = v_household
      and kind = 'rotation'
      and due_on >= p_week_start
      and due_on < p_week_start + 7
  ) then
    raise exception 'Cette semaine est déjà tirée';
  end if;

  for r in
    select t.id as template_id, t.title, t.details, t.effort, t.time_hint, t.slot,
           d::date as due_on
    from public.chore_templates t
    cross join generate_series(p_week_start, p_week_start + 6, interval '1 day') as d
    where t.household_id = v_household
      and t.active
      and extract(isodow from d)::smallint = any (t.weekdays)
    order by random()
  loop
    if r.slot is not null and not (r.slot = any (public.open_slots(r.due_on))) then
      continue;
    end if;

    v_primary := public.pick_member(v_household, r.effort, p_week_start, null, r.due_on);

    if v_primary is null then
      insert into public.assignments (
        household_id, template_id, title, details, kind, status, due_on, due_time, slot
      ) values (
        v_household, r.template_id, r.title, r.details, 'offer', 'open',
        r.due_on, r.time_hint, r.slot
      );
      v_count := v_count + 1;
      continue;
    end if;

    select id into v_exempt
    from public.exemptions
    where profile_id = v_primary and consumed_at is null
    order by created_at
    limit 1;

    if v_exempt is not null then
      v_fallback := public.pick_member(v_household, r.effort, p_week_start, v_primary, r.due_on);
      if v_fallback is not null then
        update public.exemptions set consumed_at = now() where id = v_exempt;
        v_primary := v_fallback;
      end if;
    end if;

    insert into public.assignments (
      household_id, template_id, title, details, kind, status,
      assignee_id, due_on, due_time, slot
    ) values (
      v_household, r.template_id, r.title, r.details, 'rotation', 'accepted',
      v_primary, r.due_on, r.time_hint, r.slot
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.pick_member(uuid, text, date, uuid, date) from public, anon, authenticated;

create or replace function public.settle_past_days()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_tz text;
  v_today date;
  v_count integer;
begin
  select p.household_id, h.timezone into v_household, v_tz
  from public.profiles p
  join public.households h on h.id = p.household_id
  where p.id = auth.uid();

  if v_household is null then
    raise exception 'Pas de foyer';
  end if;

  v_today := (timezone(coalesce(v_tz, 'Europe/Paris'), now()))::date;

  update public.assignments
  set status = 'done',
      assumed = true,
      completed_at = coalesce(completed_at, now())
  where household_id = v_household
    and due_on < v_today
    and status in ('open', 'accepted');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.close_day(p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_tz text;
  v_today date;
  v_count integer;
begin
  select p.household_id, h.timezone into v_household, v_tz
  from public.profiles p
  join public.households h on h.id = p.household_id
  where p.id = auth.uid();

  if v_household is null then
    raise exception 'Pas de foyer';
  end if;

  v_today := (timezone(coalesce(v_tz, 'Europe/Paris'), now()))::date;
  if p_day >= v_today then
    return 0;
  end if;

  update public.assignments
  set status = 'done',
      assumed = true,
      completed_at = coalesce(completed_at, now())
  where household_id = v_household
    and due_on = p_day
    and status in ('open', 'accepted');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.mark_not_done(p_id uuid)
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
  if v_row.status <> 'done' then
    raise exception 'Cette tâche n’est pas considérée faite';
  end if;

  update public.assignments
  set status = 'missed', assumed = false, completed_at = null, completed_by = null
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.settle_past_days() from public, anon;
revoke all on function public.mark_not_done(uuid) from public, anon;
grant execute on function public.settle_past_days() to authenticated;
grant execute on function public.mark_not_done(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.household_rhythms;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.calendar_periods;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.absences;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.pings;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.thanks;
exception
  when duplicate_object then null;
end $$;
