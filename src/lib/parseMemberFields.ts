// Accepts plain numbers ("1234567"), comma-separated ("1,234,567"), or
// shorthand ("1B", "251.4M") the way members type power values casually.
export function parsePower(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const shorthand = s.match(/^([\d.]+)\s*([MB])$/i);
  if (shorthand) {
    const num = parseFloat(shorthand[1]);
    const mult = shorthand[2].toUpperCase() === "B" ? 1_000_000_000 : 1_000_000;
    return Math.round(num * mult);
  }
  const digits = s.replace(/,/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function parseLevel(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export function parseAliases(raw: string): string[] {
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}
