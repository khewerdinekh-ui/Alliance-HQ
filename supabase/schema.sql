-- Alliance HQ — schema (stage 3: no personal passwords)
-- Members only ever enter: Player name, Chief ID, Alliance name, State,
-- and the shared Alliance password. No individual account/password.
-- Under the hood each browser gets an anonymous Supabase auth session;
-- org_members is keyed by (org_id, chief_id) so re-joining from any
-- device with the right alliance password reclaims that Chief ID's seat.
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: drops and recreates everything (no real data exists yet)

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();
drop trigger if exists members_set_updated_at on members;
drop table if exists members;
drop table if exists sub_alliances;
drop table if exists org_members;
drop table if exists orgs;
drop table if exists alliances;
drop table if exists profiles;
drop function if exists set_updated_at();
drop function if exists create_org(text, text, text, text, text);
drop function if exists join_org(text, text, text, text);
drop function if exists join_org(text, text, text, text, text);
drop function if exists is_org_member(uuid);
drop function if exists is_org_admin(uuid);

create extension if not exists pgcrypto;

-- Orgs: one per "Command Centre" (what a member creates or joins).
-- Gated by a shared password set by the R5 who creates it.
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  state text,
  password_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Membership within an org, keyed by Chief ID (not by auth session) so a
-- member can reclaim their seat from any device by re-entering it.
create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  chief_id text not null,
  display_name text not null,
  alliance_rank text not null default 'R1' check (alliance_rank in ('R1','R2','R3','R4','R5')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, chief_id)
);

-- Sub-alliances within an org (e.g. ICX, ICY)
create table sub_alliances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

-- Members roster (admin-managed entries, may or may not have a login seat)
create table members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  chief_id text,
  sub_alliance_id uuid references sub_alliances(id) on delete set null,
  power bigint,
  level integer,
  alliance_rank text not null default 'R1' check (alliance_rank in ('R1','R2','R3','R4','R5')),
  status text not null default 'current' check (status in ('current','old')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger members_set_updated_at
  before update on members
  for each row execute function set_updated_at();

-- Helpers used by RLS policies
create or replace function is_org_member(target_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from org_members
    where org_id = target_org_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function is_org_admin(target_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from org_members
    where org_id = target_org_id and user_id = auth.uid() and is_admin
  );
$$ language sql security definer stable;

alter table orgs enable row level security;
alter table org_members enable row level security;
alter table sub_alliances enable row level security;
alter table members enable row level security;

create policy "org members can read their org"
  on orgs for select
  using (is_org_member(id));

create policy "org members can read membership rows in their org"
  on org_members for select
  using (is_org_member(org_id));

create policy "admins manage org_members in their org"
  on org_members for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

create policy "org members can read sub_alliances in their org"
  on sub_alliances for select
  using (is_org_member(org_id));

create policy "admins manage sub_alliances in their org"
  on sub_alliances for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

create policy "org members can read members roster in their org"
  on members for select
  using (is_org_member(org_id));

create policy "admins manage members roster in their org"
  on members for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

-- Create a new org: caller becomes its R5 admin.
create or replace function create_org(
  org_name text,
  org_state text,
  org_password text,
  chief_id text,
  display_name text
)
returns uuid as $$
declare
  new_org_id uuid;
begin
  insert into orgs (name, state, password_hash, created_by)
  values (org_name, org_state, crypt(org_password, gen_salt('bf')), auth.uid())
  returning id into new_org_id;

  insert into org_members (org_id, user_id, chief_id, display_name, alliance_rank, is_admin)
  values (new_org_id, auth.uid(), chief_id, display_name, 'R5', true);

  return new_org_id;
end;
$$ language plpgsql security definer;

-- Join (or reclaim your seat in) an existing org by name + state + shared password.
create or replace function join_org(
  org_name text,
  org_state text,
  org_password text,
  chief_id text,
  display_name text
)
returns uuid as $$
declare
  target_org orgs%rowtype;
begin
  select * into target_org from orgs where name = org_name;

  if target_org.id is null then
    raise exception 'No alliance found with that name';
  end if;

  if coalesce(target_org.state, '') <> coalesce(org_state, '') then
    raise exception 'Alliance name and state don''t match';
  end if;

  if target_org.password_hash <> crypt(org_password, target_org.password_hash) then
    raise exception 'Incorrect alliance password';
  end if;

  insert into org_members (org_id, user_id, chief_id, display_name)
  values (target_org.id, auth.uid(), chief_id, display_name)
  on conflict (org_id, chief_id) do update
    set user_id = excluded.user_id, display_name = excluded.display_name;

  return target_org.id;
end;
$$ language plpgsql security definer;
