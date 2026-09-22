-- Alliance HQ — stage 4: event attendance tracking (Foundry/Canyon/Bear)
-- Additive migration — safe to run even with real data already in place.
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  event_type text not null check (event_type in ('foundry', 'canyon', 'bear')),
  event_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  status text not null default 'no_show' check (status in ('attended', 'excused', 'no_show')),
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create table if not exists punishments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  event_type text not null check (event_type in ('foundry', 'canyon', 'bear')),
  reason text,
  required_events integer not null default 1,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

alter table events enable row level security;
alter table attendance enable row level security;
alter table punishments enable row level security;

drop policy if exists "org members can read events in their org" on events;
create policy "org members can read events in their org"
  on events for select
  using (is_org_member(org_id));

drop policy if exists "admins manage events in their org" on events;
create policy "admins manage events in their org"
  on events for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

drop policy if exists "org members can read attendance in their org" on attendance;
create policy "org members can read attendance in their org"
  on attendance for select
  using (is_org_member(org_id));

drop policy if exists "admins manage attendance in their org" on attendance;
create policy "admins manage attendance in their org"
  on attendance for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

drop policy if exists "org members can read punishments in their org" on punishments;
create policy "org members can read punishments in their org"
  on punishments for select
  using (is_org_member(org_id));

drop policy if exists "admins manage punishments in their org" on punishments;
create policy "admins manage punishments in their org"
  on punishments for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));
