// Each alliance runs two legions, so with ICX and ICY there are four:
// "ICX Legion 1", "ICX Legion 2", "ICY Legion 1", "ICY Legion 2". Any legion
// name already saved on a record (e.g. the older plain "Legion 1") is kept in
// the list so existing data still displays.
export function legionOptions(
  subAlliances: { name: string }[],
  alsoInclude: (string | null | undefined)[] = []
): string[] {
  const base = subAlliances.length
    ? subAlliances.flatMap((a) => [`${a.name} Legion 1`, `${a.name} Legion 2`])
    : ["Legion 1", "Legion 2"];
  const extras = [...new Set(alsoInclude.filter((l): l is string => !!l && !base.includes(l)))];
  return [...base, ...extras];
}
