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
};

const SYSTEM_PROMPT = `You read screenshots of a mobile game alliance's event sign-up or attendance list.
For every player listed, extract: their name or Chief ID (whichever is shown), whether they signed up,
whether they arrived/participated, and any reason/excuse text shown for an absence.
Respond with strict JSON only: {"rows": [{"nameOrChiefId": string, "signedUp": boolean, "arrived": boolean, "reason": string}]}.
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
  }));
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
