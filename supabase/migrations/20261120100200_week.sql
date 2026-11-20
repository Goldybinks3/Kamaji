-- Jalon 5 : modèles, énergie, exonérations, tirage du lundi.
-- Les jours suivent l’ISO : 1 = lundi, 7 = dimanche.
-- Le compteur du tirage n’est pas exposé : les exonérations se lisent seulement pour soi.

create table public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  details text,
  effort text not null default 'normal' check (effort in ('light', 'normal', 'heavy')),
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  time_hint time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
);

alter table public.assignments
  add constraint assignments_template_fk
  foreign key (template_id) references public.chore_templates (id) on delete set null;

create table public.exemptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source_assignment_id uuid references public.assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index exemptions_open_idx
  on public.exemptions (profile_id)
  where consumed_at is null;

create table public.energy_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  energy text not null check (energy in ('low', 'ok', 'high')),
  created_at timestamptz not null default now()
);

alter table public.chore_templates enable row level security;
alter table public.exemptions enable row level security;
alter table public.energy_checkins enable row level security;

create policy templates_member on public.chore_templates
for all to authenticated
using (household_id = public.current_household_id())
with check (household_id = public.current_household_id());

create policy exemptions_select on public.exemptions
for select to authenticated
using (profile_id = auth.uid());

create policy checkins_select on public.energy_checkins
for select to authenticated
using (profile_id = auth.uid());

create policy checkins_insert on public.energy_checkins
for insert to authenticated
with check (
  profile_id = auth.uid()
  and household_id = public.current_household_id()
);

grant select, insert, update, delete on public.chore_templates to authenticated;
grant select on public.exemptions to authenticated;
grant select, insert on public.energy_checkins to authenticated;
revoke all on public.chore_templates from anon;
revoke all on public.exemptions from anon;
revoke all on public.energy_checkins from anon;

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
  set status = 'done', completed_by = auth.uid(), completed_at = now()
  where id = p_id
  returning * into v_row;

  if v_row.kind = 'offer' then
    insert into public.exemptions (household_id, profile_id, source_assignment_id)
    values (v_household, auth.uid(), p_id);
  end if;

  return v_row;
end;
$$;

create or replace function public.release_assignment(p_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_row public.assignments;
  v_kind text;
begin
  v_household := public.current_household_id();

  select * into v_row
  from public.assignments
  where id = p_id and household_id = v_household
  for update;

  if not found or v_row.assignee_id <> auth.uid() or v_row.status <> 'accepted' then
    raise exception 'Cette tâche n’est pas à toi';
  end if;

  v_kind := case when v_row.kind = 'paid' then 'paid' else 'offer' end;

  update public.assignments
  set assignee_id = null, status = 'open', kind = v_kind
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Semaine d’abord, énergie basse ensuite, historique sur 28 jours en dernier recours.
create or replace function public.pick_member(
  p_household uuid,
  p_effort text,
  p_week_start date,
  p_exclude uuid default null
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
    select t.id as template_id, t.title, t.details, t.effort, t.time_hint,
           d::date as due_on
    from public.chore_templates t
    cross join generate_series(p_week_start, p_week_start + 6, interval '1 day') as d
    where t.household_id = v_household
      and t.active
      and extract(isodow from d)::smallint = any (t.weekdays)
    order by random()
  loop
    v_primary := public.pick_member(v_household, r.effort, p_week_start, null);

    if v_primary is null then
      insert into public.assignments (
        household_id, template_id, title, details, kind, status, due_on, due_time
      ) values (
        v_household, r.template_id, r.title, r.details, 'offer', 'open',
        r.due_on, r.time_hint
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
      v_fallback := public.pick_member(v_household, r.effort, p_week_start, v_primary);
      if v_fallback is not null then
        update public.exemptions set consumed_at = now() where id = v_exempt;
        v_primary := v_fallback;
      end if;
    end if;

    insert into public.assignments (
      household_id, template_id, title, details, kind, status,
      assignee_id, due_on, due_time
    ) values (
      v_household, r.template_id, r.title, r.details, 'rotation', 'accepted',
      v_primary, r.due_on, r.time_hint
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.pick_member(uuid, text, date, uuid) from public, anon, authenticated;
revoke all on function public.complete_assignment(uuid) from public, anon;
revoke all on function public.release_assignment(uuid) from public, anon;
revoke all on function public.generate_week(date) from public, anon;
grant execute on function public.complete_assignment(uuid) to authenticated;
grant execute on function public.release_assignment(uuid) to authenticated;
grant execute on function public.generate_week(date) to authenticated;
