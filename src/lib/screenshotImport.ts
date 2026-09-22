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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: "Extract the attendance list from the following screenshot(s).",
    },
    ...dataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";

  let parsed: { rows?: ExtractedAttendanceRow[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Couldn't parse the model's response as JSON.");
  }

  return (parsed.rows ?? []).map((r) => ({
    nameOrChiefId: String(r.nameOrChiefId ?? "").trim(),
    signedUp: Boolean(r.signedUp),
    arrived: Boolean(r.arrived),
    reason: String(r.reason ?? "").trim(),
  }));
}
