-- Alliance HQ — joined_at: members who joined within the last 3 months have
-- their percentages calculated from the day they joined, not the full window.
-- Existing members stay NULL (= full window, same as before); only members
-- created from now on get today's date automatically.
alter table members add column if not exists joined_at date;
alter table members alter column joined_at set default current_date;
