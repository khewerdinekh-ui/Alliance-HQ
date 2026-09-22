-- Alliance HQ — schema (stage 1: auth by Chief ID + members roster)
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: drops and recreates stage-1 objects (no real data exists yet)

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();
drop trigger if exists members_set_updated_at on members;
drop table if exists members;
drop table if exists alliances;
drop table if exists profiles;
drop function if exists set_updated_at();

-- Profiles: one row per authenticated user, linked to Supabase auth.
-- Members log in with their Chief ID; Supabase still needs an email internally,
-- so we generate one from the Chief ID (e.g. "78083388@chiefid.alliance-hq") and
-- never show it anywhere.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  chief_id text not null unique,
  display_name text not null,
  alliance_rank text not null default 'R1' check (alliance_rank in ('R1','R2','R3','R4','R5')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Sub-alliances (e.g. ICX, ICY)
create table alliances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Members roster
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chief_id text,
  alliance_id uuid references alliances(id) on delete set null,
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

-- Row Level Security: any signed-in user can read; only admins can write
alter table profiles enable row level security;
alter table alliances enable row level security;
alter table members enable row level security;

create policy "profiles readable by signed-in users"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "alliances readable by signed-in users"
  on alliances for select
  using (auth.role() = 'authenticated');

create policy "admins manage alliances"
  on alliances for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

create policy "members readable by signed-in users"
  on members for select
  using (auth.role() = 'authenticated');

create policy "admins manage members"
  on members for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- Auto-create a profile row whenever a new user signs up.
-- chief_id and display_name are passed in via signUp's options.data.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, chief_id, display_name)
  values (
    new.id,
    new.raw_user_meta_data->>'chief_id',
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'chief_id')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Seed the known sub-alliances
insert into alliances (name) values ('ICX'), ('ICY')
on conflict (name) do nothing;
