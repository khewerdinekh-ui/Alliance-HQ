-- Alliance HQ — stage 8: punishment resolution history
alter table punishments add column if not exists resolved_at timestamptz;
