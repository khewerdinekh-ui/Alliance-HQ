-- Alliance HQ — let an org admin change their alliance's shared password.
-- SECURITY DEFINER so it can write password_hash despite RLS, but it checks
-- is_org_admin() itself first, so only that org's admins can call it.

create or replace function update_org_password(p_org_id uuid, p_new_password text)
returns void as $$
begin
  if not is_org_admin(p_org_id) then
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
