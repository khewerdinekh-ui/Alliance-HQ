type Collapsible = { nameOrChiefId: string; score?: number | null; memberId: string | null };

// Screenshots and videos repeat things — e.g. the viewer's own row is pinned
// to the bottom of every results screen — so the same player is read many
// times. This keeps one row per player and reports what it merged:
//  1. the same name read more than once → one row (highest score wins);
//  2. different spellings that resolved to the same member with the same
//     score → one row.
// Anything left (same member, different scores) is a real conflict the admin
// has to settle, flagged by duplicateMemberIds.
export function collapseRows<T extends Collapsible>(rows: T[]): { rows: T[]; notes: string[] } {
  const notes: string[] = [];

  const byName = new Map<string, { row: T; count: number }>();
  for (const row of rows) {
    const key = row.nameOrChiefId.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, { row, count: 1 });
    } else {
      prev.count += 1;
      if ((row.score ?? -1) > (prev.row.score ?? -1)) prev.row = row;
    }
  }
  for (const { row, count } of byName.values()) {
    if (count > 1) notes.push(`"${row.nameOrChiefId}" was read ${count} times — kept once.`);
  }

  const seen = new Set<string>();
  const out: T[] = [];
  for (const { row } of byName.values()) {
    if (row.memberId) {
      const key = `${row.memberId}|${row.score ?? ""}`;
      if (seen.has(key)) {
        notes.push(`"${row.nameOrChiefId}" is the same member and score as another row — kept once.`);
        continue;
      }
      seen.add(key);
    }
    out.push(row);
  }
  return { rows: out, notes };
}

// Members that more than one row is currently matched to. Only one attendance
// record can exist per member per event, so these must be fixed before import.
export function duplicateMemberIds(rows: { memberId: string | null }[]): Set<string> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.memberId) counts.set(r.memberId, (counts.get(r.memberId) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id));
}
