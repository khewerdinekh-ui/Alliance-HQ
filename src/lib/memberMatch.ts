export type MatchableMember = { id: string; name: string; chiefId: string | null; aliases?: string[] };

// Strips a leading alliance tag like "[ICY]" or "[ICX] " from an in-game
// display name, since the roster stores names without it but screenshots/CSV
// exports usually include it.
function stripTag(name: string) {
  return name.replace(/^\s*\[[^\]]+\]\s*/, "").trim();
}

// Best-effort guess: exact Chief ID, then current name or any previous name
// (alias) — exact, then with a leading alliance tag stripped. Returns null
// when nothing is confident.
export function guessMemberId(nameOrChiefId: string, members: MatchableMember[]): string | null {
  const key = nameOrChiefId.trim();
  if (!key) return null;

  const byChiefId = members.find((m) => m.chiefId === key);
  if (byChiefId) return byChiefId.id;

  const matchesName = (m: MatchableMember, target: string) =>
    m.name.toLowerCase() === target || (m.aliases ?? []).some((a) => a.toLowerCase() === target);

  const lower = key.toLowerCase();
  const byName = members.find((m) => matchesName(m, lower));
  if (byName) return byName.id;

  const stripped = stripTag(key).toLowerCase();
  if (stripped) {
    const byStrippedName = members.find((m) => matchesName(m, stripped));
    if (byStrippedName) return byStrippedName.id;
  }

  return null;
}
