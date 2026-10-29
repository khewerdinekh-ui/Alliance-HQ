-- Alliance HQ — SvS prep: each import of the prep-points leaderboard is one
-- "prep event" (a date + optional label such as "Day 3"); the members who
-- appear in its top 100 are stored as results. The Percentages page counts how
-- often each member made the top 100 across prep events in the last 3 months.

create table if not exists svs_prep_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  event_date date not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (org_id, event_date, label)
);

create table if not exists svs_prep_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  event_id uuid not null references svs_prep_events(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  rank integer,
  points bigint,
  unique (event_id, member_id)
);

alter table svs_prep_events enable row level security;
alter table svs_prep_results enable row level security;

drop policy if exists "org members can read svs prep events" on svs_prep_events;
create policy "org members can read svs prep events"
  on svs_prep_events for select
  using (is_org_member(org_id));

drop policy if exists "admins manage svs prep events" on svs_prep_events;
create policy "admins manage svs prep events"
  on svs_prep_events for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

drop policy if exists "org members can read svs prep results" on svs_prep_results;
create policy "org members can read svs prep results"
  on svs_prep_results for select
  using (is_org_member(org_id));

drop policy if exists "admins manage svs prep results" on svs_prep_results;
create policy "admins manage svs prep results"
  on svs_prep_results for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));
