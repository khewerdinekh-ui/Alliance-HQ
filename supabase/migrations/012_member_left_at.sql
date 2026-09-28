-- Alliance HQ — record when a member left, instead of just flipping status.
alter table members
  add column if not exists left_at date;
