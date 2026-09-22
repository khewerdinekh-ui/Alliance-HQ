// Supabase's built-in auth needs an email under the hood. Members only ever
// see/enter their Chief ID, so we derive a stable, invisible email from it.
export function emailForChiefId(chiefId: string) {
  return `${chiefId.trim()}@chiefid.alliance-hq.internal`;
}
