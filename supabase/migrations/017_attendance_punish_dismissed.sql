-- Alliance HQ — "Not punished": an admin can clear someone from the
-- "Don't sign up next time" list without punishing them. The decision is kept
-- on the attendance row so it stays cleared (the miss itself still counts in
-- no-show history and percentages).
alter table attendance add column if not exists punish_dismissed boolean not null default false;
