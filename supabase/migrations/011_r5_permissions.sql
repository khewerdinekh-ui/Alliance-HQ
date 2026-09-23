-- Alliance HQ — split "admin" (is_admin: import/edit content) from "R5"
-- (alliance_rank = 'R5': the Admin page itself — ranks, promotions, removals,
-- sub-alliances, alliance name/state/password). Also fixes a real bug: orgs
-- had NO update policy at all, so Bear times and Alliance details updates
-- have been silently failing (RLS blocked them, and the app never checked
-- the error).

create or replace function is_org_r5(target_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from org_members
    where org_id = target_org_id and user_id = auth.uid() and alliance_rank = 'R5'
  );
$$ language sql security definer stable;

-- Bear times (bear_time_1..4) are an admin-level (is_admin) edit, same as
-- everything else on the Bear/Foundry/Canyon pages — this is the first
-- update policy orgs has ever had.
drop policy if exists "admins manage orgs" on orgs;
create policy "admins manage orgs"
  on orgs for update
  using (is_org_admin(id))
  with check (is_org_admin(id));

-- Rank changes, admin promotion/demotion, member removal: R5 only now.
drop policy if exists "admins manage org_members in their org" on org_members;
create policy "r5 manage org_members in their org"
  on org_members for all
  using (is_org_r5(org_id))
  with check (is_org_r5(org_id));

-- Sub-alliances: R5 only now.
drop policy if exists "admins manage sub_alliances in their org" on sub_alliances;
create policy "r5 manage sub_alliances in their org"
  on sub_alliances for all
  using (is_org_r5(org_id))
  with check (is_org_r5(org_id));

-- Alliance name/state: R5-checked RPC (SECURITY DEFINER — bypasses the
-- broader is_admin update policy above so this stays R5-only regardless).
create or replace function update_org_details(p_org_id uuid, p_name text, p_state text)
returns void as $$
begin
  if not is_org_r5(p_org_id) then
    raise exception 'Forbidden';
  end if;

  update orgs set name = p_name, state = p_state where id = p_org_id;
end;
$$ language plpgsql security definer;

-- Alliance password: was is_org_admin, now R5 only.
create or replace function update_org_password(p_org_id uuid, p_new_password text)
returns void as $$
begin
  if not is_org_r5(p_org_id) then
    raise exception 'Forbidden';
  end if;
  if length(p_new_password) < 8 then
    raise exception 'Alliance password must be at least 8 characters.';
  end if;

  update orgs
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = p_org_id;
end;
$$ language plpgsql security definer;

-- R5 hand-off: current R5 demotes themself to R4 and promotes the target to
-- R5, atomically, so there's never a moment with two (or zero) R5s.
create or replace function transfer_r5(p_org_id uuid, p_new_r5_member_id uuid)
returns void as $$
declare
  caller_member_id uuid;
begin
  if not is_org_r5(p_org_id) then
    raise exception 'Forbidden';
  end if;

  select id into caller_member_id
  from org_members
  where org_id = p_org_id and user_id = auth.uid() and alliance_rank = 'R5';

  if caller_member_id is null then
    raise exception 'Forbidden';
  end if;

  if not exists (
    select 1 from org_members where id = p_new_r5_member_id and org_id = p_org_id
  ) then
    raise exception 'Member not found in this alliance.';
  end if;

  update org_members set alliance_rank = 'R4' where id = caller_member_id;
  update org_members set alliance_rank = 'R5', is_admin = true where id = p_new_r5_member_id;
end;
$$ language plpgsql security definer;
