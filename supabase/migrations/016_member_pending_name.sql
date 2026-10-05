-- Alliance HQ — pending_name: when an import row is manually matched to a
-- member under a different spelling, the member keeps their name; the
-- spelling read is saved as an alias and also parked here so an admin can
-- confirm a real in-game rename (or dismiss an OCR misread).
alter table members add column if not exists pending_name text;
