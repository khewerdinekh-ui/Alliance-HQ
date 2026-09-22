-- Alliance HQ — stage 5: public contact messages (for prospective alliances)
-- Additive migration — safe to run alongside existing data.

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alliance_name text,
  contact_info text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

-- Anyone (including prospective alliances with no account yet) can send one.
drop policy if exists "anyone can submit a contact message" on contact_messages;
create policy "anyone can submit a contact message"
  on contact_messages for insert
  with check (true);

-- No select policy: read them from the Supabase Table Editor as the project owner.
