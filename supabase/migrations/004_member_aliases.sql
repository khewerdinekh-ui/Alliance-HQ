-- Alliance HQ — stage 6: previous names (aliases) on members
alter table members add column if not exists aliases text[] not null default '{}';
