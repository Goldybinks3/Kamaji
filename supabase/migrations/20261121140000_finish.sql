-- Dettes privées, lien de recette, tirage sans session, dimanche 18 h et rappel de 17 h.

alter table public.meals
  add column if not exists recipe_url text;

alter table public.meals
  drop constraint if exists meals_recipe_url_check;

alter table public.meals
  add constraint meals_recipe_url_check
  check (recipe_url is null or recipe_url ~* '^https?://');

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  debtor_id uuid not null references public.profiles (id) on delete cascade,
  creditor_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  check (debtor_id <> creditor_id)
);

alter table public.debts enable row level security;

drop policy if exists debts_pair on public.debts;
create policy debts_pair on public.debts
for select to authenticated
using (
  household_id = public.current_household_id()
  and (debtor_id = auth.uid() or creditor_id = auth.uid())
);

grant select on public.debts to authenticated;
revoke all on public.debts from anon;

create table if not exists public.kamaji_private (
  key text primary key,
  value text not null
);

revoke all on public.kamaji_private from public, anon, authenticated;

insert into public.kamaji_private (key, value)
values ('notify_url', 'https://frplodqpjrrellqnyfrl.supabase.co/functions/v1/notify')
on conflict (key) do nothing;

insert into public.kamaji_private (key, value)
values ('cron_secret', '')
on conflict (key) do nothing;

create or replace function public.record_paid_debt(p_row public.assignments)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_row.kind is distinct from 'paid' then
    return;
  end if;
  if p_row.price_cents is null or p_row.price_cents <= 0 then
    return;
  end if;
  if p_row.requested_by is null or p_row.assignee_id is null then
    return;
  end if;
  if p_row.requested_by = p_row.assignee_id then
    return;
  end if;

  insert into public.debts (
    household_id, assignment_id, debtor_id, creditor_id, amount_cents
  ) values (
    p_row.household_id, p_row.id, p_row.requested_by, p_row.assignee_id, p_row.price_cents
  )
  on conflict (assignment_id) do nothing;
end;
$$;

revoke all on function public.record_paid_debt(public.assignments) from public, anon, authenticated;

create or replace function public.open_slots_for(p_household uuid, p_day date)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slots text[];
begin
  if p_household is null then
    return array['dinner']::text[];
  end if;

  select slots into v_slots
  from public.calendar_periods
  where household_id = p_household
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
  where household_id = p_household;

  return coalesce(v_slots, array['dinner']::text[]);
end;
$$;

create or replace function public.open_slots(p_day date)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  v_household := public.current_household_id();
  if v_household is null then
    raise exception 'Pas de foyer';
  end if;
  return public.open_slots_for(v_household, p_day);
end;
$$;

revoke all on function public.open_slots_for(uuid, date) from public, anon, authenticated;
revoke all on function public.open_slots(date) from public, anon;
grant execute on function public.open_slots(date) to authenticated;

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

  perform public.record_paid_debt(v_row);
  return v_row;
end;
$$;

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
  v_count integer := 0;
  v_row public.assignments;
begin
  select p.household_id, h.timezone into v_household, v_tz
  from public.profiles p
  join public.households h on h.id = p.household_id
  where p.id = auth.uid();

  if v_household is null then
    raise exception 'Pas de foyer';
  end if;

  v_today := (timezone(coalesce(v_tz, 'Europe/Paris'), now()))::date;

  for v_row in
    update public.assignments
    set status = 'done',
        assumed = true,
        completed_at = coalesce(completed_at, now())
    where household_id = v_household
      and due_on < v_today
      and status in ('open', 'accepted')
    returning *
  loop
    perform public.record_paid_debt(v_row);
    v_count := v_count + 1;
  end loop;

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
  v_count integer := 0;
  v_row public.assignments;
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

  for v_row in
    update public.assignments
    set status = 'done',
        assumed = true,
        completed_at = coalesce(completed_at, now())
    where household_id = v_household
      and due_on = p_day
      and status in ('open', 'accepted')
    returning *
  loop
    perform public.record_paid_debt(v_row);
    v_count := v_count + 1;
  end loop;

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

  delete from public.debts where assignment_id = p_id;
  return v_row;
end;
$$;

create or replace function public.generate_week_for(p_household uuid, p_week_start date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_primary uuid;
  v_fallback uuid;
  v_exempt uuid;
begin
  if p_household is null then
    raise exception 'Pas de foyer';
  end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'La semaine commence un lundi';
  end if;
  if exists (
    select 1 from public.assignments
    where household_id = p_household
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
    where t.household_id = p_household
      and t.active
      and extract(isodow from d)::smallint = any (t.weekdays)
    order by random()
  loop
    if r.slot is not null and not (r.slot = any (public.open_slots_for(p_household, r.due_on))) then
      continue;
    end if;

    v_primary := public.pick_member(p_household, r.effort, p_week_start, null, r.due_on);

    if v_primary is null then
      insert into public.assignments (
        household_id, template_id, title, details, kind, status, due_on, due_time, slot
      ) values (
        p_household, r.template_id, r.title, r.details, 'offer', 'open',
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
      v_fallback := public.pick_member(p_household, r.effort, p_week_start, v_primary, r.due_on);
      if v_fallback is not null then
        update public.exemptions set consumed_at = now() where id = v_exempt;
        v_primary := v_fallback;
      end if;
    end if;

    insert into public.assignments (
      household_id, template_id, title, details, kind, status,
      assignee_id, due_on, due_time, slot
    ) values (
      p_household, r.template_id, r.title, r.details, 'rotation', 'accepted',
      v_primary, r.due_on, r.time_hint, r.slot
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.generate_week(p_week_start date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  v_household := public.current_household_id();
  if v_household is null then
    raise exception 'Pas de foyer';
  end if;
  return public.generate_week_for(v_household, p_week_start);
end;
$$;

revoke all on function public.generate_week_for(uuid, date) from public, anon, authenticated;
revoke all on function public.generate_week(date) from public, anon;
grant execute on function public.generate_week(date) to authenticated;

create or replace function public.generate_due_weeks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_monday date;
  v_household uuid;
  v_count integer := 0;
begin
  v_today := (timezone('Europe/Paris', now()))::date;
  v_monday := v_today + (8 - extract(isodow from v_today)::integer);

  for v_household in
    select id from public.households
  loop
    begin
      perform public.generate_week_for(v_household, v_monday);
      v_count := v_count + 1;
    exception
      when others then
        if sqlerrm not like '%déjà tirée%' then
          raise notice 'Kamaji foyer % : %', v_household, sqlerrm;
        end if;
    end;
  end loop;

  return v_count;
end;
$$;

create or replace function public.request_evening_push()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_secret from public.kamaji_private where key = 'cron_secret';
  select value into v_url from public.kamaji_private where key = 'notify_url';
  if v_secret is null or length(v_secret) = 0 or v_url is null or length(v_url) = 0 then
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{"kind":"evening"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-kamaji-cron', v_secret
    )
  );
exception
  when others then
    raise notice 'Kamaji rappel 17 h non envoyé : %', sqlerrm;
end;
$$;

create or replace function public.kamaji_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp;
begin
  v_local := timezone('Europe/Paris', now());
  if extract(isodow from v_local) = 7 and extract(hour from v_local) = 18 then
    perform public.generate_due_weeks();
  end if;
  if extract(hour from v_local) = 17 then
    perform public.request_evening_push();
  end if;
end;
$$;

revoke all on function public.generate_due_weeks() from public, anon, authenticated;
revoke all on function public.request_evening_push() from public, anon, authenticated;
revoke all on function public.kamaji_tick() from public, anon, authenticated;

do $outer$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      null;
  end;
  begin
    perform cron.unschedule('kamaji-tick');
  exception
    when others then
      null;
  end;
  perform cron.schedule(
    'kamaji-tick',
    '0 * * * *',
    $job$select public.kamaji_tick()$job$
  );
exception
  when others then
    raise notice 'Kamaji : pg_cron non activé (%). Le bouton Préparer la semaine reste disponible.', sqlerrm;
end
$outer$;
