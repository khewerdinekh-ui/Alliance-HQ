-- Alliance HQ — Bear results leaderboard: a damage score per member per Bear slot,
-- replacing the arrived/did-not-arrive grid for Bear only. Having a saved score
-- IS attendance for that slot (status stays 'attended' whenever a score is set).
-- Additive migration — safe to run even with real data already in place.

alter table attendance
  add column if not exists score bigint;
