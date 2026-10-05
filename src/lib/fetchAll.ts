// Supabase returns at most 1,000 rows per query. Anything bigger — e.g. three
// months of attendance for a ~150-member alliance — was silently truncated,
// which dropped whole events from people's percentages. This pages through
// with .range() until a short page comes back.
const PAGE = 1000;

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}
