-- Code d’invitation sécurisé (16 caractères lisibles, ~80 bits d’entropie)
-- et normalisation (majuscules, espaces, tirets) lors de la saisie ou du lien.

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_hex text;
  v_out text := '';
  v_i integer;
  v_idx integer;
begin
  -- Deux UUID v4 CSPRNG : 64 caractères hexadécimaux (244 bits aléatoires).
  v_hex := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  for v_i in 0..15 loop
    v_idx := (('x' || substr(v_hex, v_i * 2 + 1, 2))::bit(8)::integer % 32) + 1;
    v_out := v_out || substr(v_alphabet, v_idx, 1);
  end loop;
  return substr(v_out, 1, 4) || '-' || substr(v_out, 5, 4) || '-' ||
         substr(v_out, 9, 4) || '-' || substr(v_out, 13, 4);
end;
$$;

revoke all on function public.generate_invite_code() from public, anon, authenticated;

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
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Choisis un nom de famille';
  end if;
  if length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'Choisis ton prénom';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Tu as déjà un foyer';
  end if;

  v_code := public.generate_invite_code();
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
  v_clean text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'Choisis ton prénom';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Tu as déjà un foyer';
  end if;

  v_clean := regexp_replace(upper(trim(coalesce(p_code, ''))), '[^A-Z0-9]', '', 'g');
  if length(v_clean) < 6 then
    raise exception 'Code invalide';
  end if;

  select id into v_id
  from public.households
  where regexp_replace(upper(invite_code), '[^A-Z0-9]', '', 'g') = v_clean;

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

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
