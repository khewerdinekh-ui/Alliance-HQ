function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callVisionExtractor(
  systemPrompt: string,
  userText: string,
  dataUrls: string[],
  maxTokens = 4000
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: userText },
    ...dataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  const body = JSON.stringify({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
    max_tokens: maxTokens,
  });

  // Several parallel/queued extraction calls can burst past the account's
  // tokens-per-minute rate limit; OpenAI's 429 tells us almost exactly how
  // long to wait, so retry a couple of times instead of failing the batch.
  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (res.status !== 429 || attempt >= 3) break;

    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : 2000 * (attempt + 1);
    await sleep(waitMs);
    attempt += 1;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Couldn't parse the model's response as JSON.");
  }
}

export type ExtractedAttendanceRow = {
  nameOrChiefId: string;
  signedUp: boolean;
  arrived: boolean;
  reason: string;
  score: number | null;
  lineupRole: "main" | "sub" | null;
};

const SYSTEM_PROMPT = `You read screenshots (or frames of a screen recording) of a mobile game alliance's event sign-up, attendance or results list.
For every player listed, extract: their name or Chief ID (whichever is shown), whether they signed up,
whether they arrived/participated, any reason/excuse text shown for an absence, and their score/points
for the event if a number is shown next to them (digits only, no separators), otherwise null.
List every player visible across all images exactly once. Do not guess or invent players.
Copy each name exactly as displayed, including symbols and decorations — do not tidy or translate it.
The score is the number shown for that player's row: read every digit, and return null if any of it is cut
off or hidden. Skip a row entirely if its name is cut off at the edge of the frame; it will appear whole in
another frame. The same player will appear in several overlapping frames — return them once.
Also extract whether each player is in the main lineup or is a substitute: lineupRole is "main" or "sub"
(a "Sub"/"Substitute"/"Reserve" label or a separate substitutes section means "sub"; a "Main"/"Starter" label or the
main section means "main"), or null if the image doesn't say.
Respond with strict JSON only: {"rows": [{"nameOrChiefId": string, "signedUp": boolean, "arrived": boolean, "reason": string, "score": number | null, "lineupRole": "main" | "sub" | null}]}.
If arrival status isn't shown, assume arrived=false and signedUp=true for anyone listed.
Use "" for reason when none is shown. Do not include any text outside the JSON object.`;

export async function extractAttendanceFromImages(
  dataUrls: string[]
): Promise<ExtractedAttendanceRow[]> {
  const parsed = (await callVisionExtractor(
    SYSTEM_PROMPT,
    "Extract the attendance list from the following screenshot(s).",
    dataUrls
  )) as { rows?: ExtractedAttendanceRow[] };

  return (parsed.rows ?? []).map((r) => ({
    nameOrChiefId: String(r.nameOrChiefId ?? "").trim(),
    signedUp: Boolean(r.signedUp),
    arrived: Boolean(r.arrived),
    reason: String(r.reason ?? "").trim(),
    score: Number.isFinite(Number(r.score)) && r.score != null ? Number(r.score) : null,
    lineupRole: r.lineupRole === "sub" ? "sub" : r.lineupRole === "main" ? "main" : null,
  }));
}

export type ExtractedTroopRow = {
  name: string;
  infantry: string | null;
  lancers: string | null;
  marksmen: string | null;
  slot1: boolean | null;
  slot2: boolean | null;
  slot3: boolean | null;
  unavailable: boolean | null;
};

const TROOPS_SYSTEM_PROMPT = `You read screenshots (or frames of a screen recording) of a mobile game alliance's troop and availability sheet.
Each row is one player. Columns may include:
- Infantry, Lancers, Marksmen: a tier label such as "T11(10)", "T12(10)" or "N(9)" (tier T11, T12 or N, then a level in brackets). Blank means no troops listed.
- Availability time slots "12-14 UTC", "14-16 UTC", "15-17 UTC": each is a ticked or unticked checkbox.
- A status column that says "Unavailable" for players who can't take part, otherwise blank.
For every player visible, return their name exactly as displayed and whatever of the above is visible.
Use null for anything that isn't visible in the image (for example a column that isn't shown), so it isn't overwritten.
List each player once even if they appear in several overlapping frames. Do not invent players.
Respond with strict JSON only: {"rows": [{"name": string, "infantry": string | null, "lancers": string | null, "marksmen": string | null, "slot1": boolean | null, "slot2": boolean | null, "slot3": boolean | null, "unavailable": boolean | null}]}.
slot1 = 12-14 UTC, slot2 = 14-16 UTC, slot3 = 15-17 UTC. Do not include any text outside the JSON object.`;

// "t11 ( 10 )" -> "T11(10)"; anything that isn't tier + level (T12/T11/N, 5-10) is dropped.
function normaliseTier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().toUpperCase().match(/^(T12|T11|N)\s*\(\s*(\d{1,2})\s*\)$/);
  if (!m) return null;
  const level = Number(m[2]);
  return level >= 5 && level <= 10 ? `${m[1]}(${level})` : null;
}

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export async function extractTroopsFromImages(dataUrls: string[]): Promise<ExtractedTroopRow[]> {
  const parsed = (await callVisionExtractor(
    TROOPS_SYSTEM_PROMPT,
    "Extract the troop and availability rows from the following image(s).",
    dataUrls,
    3000
  )) as { rows?: Record<string, unknown>[] };

  return (parsed.rows ?? [])
    .map((r) => ({
      name: String(r.name ?? "").trim(),
      infantry: normaliseTier(r.infantry),
      lancers: normaliseTier(r.lancers),
      marksmen: normaliseTier(r.marksmen),
      slot1: boolOrNull(r.slot1),
      slot2: boolOrNull(r.slot2),
      slot3: boolOrNull(r.slot3),
      unavailable: boolOrNull(r.unavailable),
    }))
    .filter((r) => r.name);
}

export type ExtractedBearResultRow = {
  nameOrChiefId: string;
  score: number;
};

const BEAR_RESULTS_SYSTEM_PROMPT = `You read screenshots or video frames of a mobile game's "Bear" event results/leaderboard screen.
For every player listed, extract their name or Chief ID (whichever is shown) and their damage score (a large number, may include commas).
Respond with strict JSON only: {"rows": [{"nameOrChiefId": string, "score": number}]}.
Strip commas/formatting from the score and return it as a plain number. Skip rows with no readable name or score.
Do not include any text outside the JSON object.`;

export async function extractBearResultsFromImages(dataUrls: string[]): Promise<ExtractedBearResultRow[]> {
  const parsed = (await callVisionExtractor(
    BEAR_RESULTS_SYSTEM_PROMPT,
    "Extract the Bear results leaderboard from the following screenshot(s)/frame(s).",
    dataUrls,
    8000
  )) as { rows?: ExtractedBearResultRow[] };

  return (parsed.rows ?? [])
    .map((r) => ({
      nameOrChiefId: String(r.nameOrChiefId ?? "").trim(),
      score: Number(r.score),
    }))
    .filter((r) => r.nameOrChiefId && Number.isFinite(r.score));
}

export type ExtractedMemberRow = {
  name: string;
  power: number | null;
  level: number | null;
  rank: string | null;
};

const MEMBERS_SYSTEM_PROMPT = `You read screenshots or video frames of a mobile game's alliance member roster/list screen.
Multiple frames may show overlapping or different parts of a scrolling list — combine them into one
complete list, including every distinct player you can see across ALL frames. Do not skip, omit, or
summarize any row, and do not stop early — a roster can have 100+ members and you must list all of
them. Only merge two rows into one if they are clearly the exact same player (identical name).

For every player listed, extract:
- name: their in-game name
- power: a large number, may include commas or a "K"/"M" suffix — expand it to a plain integer number
- level: their Furnace/Castle level if shown (a small integer)
- rank: their alliance rank/role if shown — R1, R2, R3, R4, or R5 (R5 is usually the leader, R4 an
  officer/deputy, often shown as a colored badge, crown, or star icon next to the name rather than text)

Respond with strict JSON only: {"rows": [{"name": string, "power": number | null, "level": number | null, "rank": string | null}]}.
Use null for any field not shown or not legible. Skip rows with no readable name.
Do not include any text outside the JSON object.`;

export async function extractMembersFromImages(dataUrls: string[]): Promise<ExtractedMemberRow[]> {
  const parsed = (await callVisionExtractor(
    MEMBERS_SYSTEM_PROMPT,
    "Extract the complete alliance member roster from the following screenshot(s)/frame(s). List every player — do not omit any.",
    dataUrls,
    3000
  )) as { rows?: ExtractedMemberRow[] };

  return (parsed.rows ?? [])
    .map((r) => ({
      name: String(r.name ?? "").trim(),
      power: r.power != null && Number.isFinite(Number(r.power)) ? Number(r.power) : null,
      level: r.level != null && Number.isFinite(Number(r.level)) ? Number(r.level) : null,
      rank: r.rank ? String(r.rank).trim().toUpperCase() : null,
    }))
    .filter((r) => r.name);
}
