-- Alliance HQ — merge two member records that turned out to be the same
-- person (duplicate DB rows, or a rename the importer couldn't link
-- automatically). Keeps p_keep_id (so its existing attendance/percentage
-- history stays intact), adopts p_remove_id's fresher roster fields onto it,
-- reassigns p_remove_id's attendance/punishment rows onto p_keep_id (skipping
-- any that would collide with an attendance row p_keep_id already has for the
-- same event), and deletes p_remove_id.

create or replace function merge_members(p_keep_id uuid, p_remove_id uuid)
returns void as $$
declare
  keep_org uuid;
  remove_org uuid;
  keep_name text;
  remove_row members%rowtype;
begin
  select org_id, name into keep_org, keep_name from members where id = p_keep_id;
  select * into remove_row from members where id = p_remove_id;
  select org_id into remove_org from members where id = p_remove_id;

  if keep_org is null or remove_org is null then
    raise exception 'Member not found.';
  end if;
  if keep_org <> remove_org or not is_org_admin(keep_org) then
    raise exception 'Forbidden';
  end if;
  if p_keep_id = p_remove_id then
    return;
  end if;

  -- Move attendance rows, skipping any that would duplicate an event p_keep_id
  -- already has a row for (the unique (event_id, member_id) constraint).
  delete from attendance a
  where a.member_id = p_remove_id
    and exists (
      select 1 from attendance k where k.member_id = p_keep_id and k.event_id = a.event_id
    );
  update attendance set member_id = p_keep_id where member_id = p_remove_id;

  update punishments set member_id = p_keep_id where member_id = p_remove_id;

  update members
  set
    name = remove_row.name,
    chief_id = coalesce(remove_row.chief_id, members.chief_id),
    power = coalesce(remove_row.power, members.power),
    level = coalesce(remove_row.level, members.level),
    alliance_rank = coalesce(remove_row.alliance_rank, members.alliance_rank),
    sub_alliance_id = coalesce(remove_row.sub_alliance_id, members.sub_alliance_id),
    status = 'current',
    left_at = null,
    aliases = (
      select array(
        select distinct unnest(
          array_remove(coalesce(members.aliases, '{}'), remove_row.name) || array[keep_name]
        )
      )
    )
  where id = p_keep_id;

  delete from members where id = p_remove_id;
end;
$$ language plpgsql security definer;
