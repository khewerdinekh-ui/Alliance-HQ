-- Alliance HQ — Bear rework: 4 configurable daily times, events tied to a slot,
-- all 4 slots on the same date treated as ONE event for percentage purposes.
-- Additive migration — safe to run even with real data already in place.
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run

alter table orgs
  add column if not exists bear_time_1 text default '01:00',
  add column if not exists bear_time_2 text default '15:00',
  add column if not exists bear_time_3 text default '18:30',
  add column if not exists bear_time_4 text default '20:00';

alter table events
  add column if not exists bear_slot smallint check (bear_slot between 1 and 4);

-- NULL bear_slot (Foundry/Canyon) never conflicts with itself under a unique index,
-- so this only guards against creating the same Bear slot twice on the same date.
drop index if exists events_org_date_bearslot_unique;
create unique index events_org_date_bearslot_unique
  on events (org_id, event_date, bear_slot);
