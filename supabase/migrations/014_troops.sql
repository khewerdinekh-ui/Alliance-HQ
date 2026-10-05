-- Alliance HQ — Troops tab: each member's dealer troop tiers (infantry,
-- lancers, marksmen, e.g. "T11(10)"), which SvS time slots they can make, and
-- an availability status. One row per member. Everyone in the org can read;
-- admins edit.

create table if not exists troops (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  infantry text not null default '',
  lancers text not null default '',
  marksmen text not null default '',
  slot_1 boolean not null default false,
  slot_2 boolean not null default false,
  slot_3 boolean not null default false,
  status text not null default '',
  updated_at timestamptz not null default now(),
  unique (member_id)
);

alter table troops enable row level security;

drop policy if exists "org members can read troops in their org" on troops;
create policy "org members can read troops in their org"
  on troops for select
  using (is_org_member(org_id));

drop policy if exists "admins manage troops in their org" on troops;
create policy "admins manage troops in their org"
  on troops for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));
