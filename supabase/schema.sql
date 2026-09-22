-- Alliance HQ — initial schema (stage 1: auth + members roster)
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run

-- Profiles: one row per authenticated user, linked to Supabase auth
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  alliance_rank text not null default 'R1' check (alliance_rank in ('R1','R2','R3','R4','R5')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Sub-alliances (e.g. ICX, ICY)
create table if not exists alliances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Members roster
create table if not exists members (
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

-- Keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists members_set_updated_at on members;
create trigger members_set_updated_at
  before update on members
  for each row execute function set_updated_at();

-- Row Level Security: any signed-in user can read; only admins can write
alter table profiles enable row level security;
alter table alliances enable row level security;
alter table members enable row level security;

drop policy if exists "profiles readable by signed-in users" on profiles;
create policy "profiles readable by signed-in users"
  on profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "alliances readable by signed-in users" on alliances;
create policy "alliances readable by signed-in users"
  on alliances for select
  using (auth.role() = 'authenticated');

drop policy if exists "admins manage alliances" on alliances;
create policy "admins manage alliances"
  on alliances for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

drop policy if exists "members readable by signed-in users" on members;
create policy "members readable by signed-in users"
  on members for select
  using (auth.role() = 'authenticated');

drop policy if exists "admins manage members" on members;
create policy "admins manage members"
  on members for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- Auto-create a profile row whenever a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Seed the known sub-alliances
insert into alliances (name) values ('ICX'), ('ICY')
on conflict (name) do nothing;
