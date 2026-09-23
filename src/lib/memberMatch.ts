export type MatchableMember = { id: string; name: string; chiefId: string | null };

// Strips a leading alliance tag like "[ICY]" or "[ICX] " from an in-game
// display name, since the roster stores names without it but screenshots/CSV
// exports usually include it.
function stripTag(name: string) {
  return name.replace(/^\s*\[[^\]]+\]\s*/, "").trim();
}

// Best-effort guess: exact Chief ID, then exact name, then name with any
// leading alliance tag stripped. Returns null when nothing is confident.
export function guessMemberId(nameOrChiefId: string, members: MatchableMember[]): string | null {
  const key = nameOrChiefId.trim();
  if (!key) return null;

  const byChiefId = members.find((m) => m.chiefId === key);
  if (byChiefId) return byChiefId.id;

  const lower = key.toLowerCase();
  const byName = members.find((m) => m.name.toLowerCase() === lower);
  if (byName) return byName.id;

  const stripped = stripTag(key).toLowerCase();
  if (stripped) {
    const byStrippedName = members.find((m) => m.name.toLowerCase() === stripped);
    if (byStrippedName) return byStrippedName.id;
  }

  return null;
}
