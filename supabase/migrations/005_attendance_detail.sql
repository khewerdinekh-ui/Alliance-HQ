-- Alliance HQ — stage 7: richer per-event attendance (legion, lineup, signed up, reason)
alter table attendance add column if not exists legion text;
alter table attendance add column if not exists lineup_role text default 'main' check (lineup_role in ('main', 'sub'));
alter table attendance add column if not exists signed_up boolean not null default true;
alter table attendance add column if not exists reason text;
