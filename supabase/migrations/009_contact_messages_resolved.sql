-- Alliance HQ — contact_messages was never actually created (migration 003 never
-- ran against the live DB), so every Contact Us submission has been silently
-- failing. Recreate it here, plus a `resolved` flag for the owner inbox.

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alliance_name text,
  contact_info text not null,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

drop policy if exists "anyone can submit a contact message" on contact_messages;
create policy "anyone can submit a contact message"
  on contact_messages for insert
  with check (true);

-- No select policy: the owner inbox reads via the service-role key, bypassing RLS.
