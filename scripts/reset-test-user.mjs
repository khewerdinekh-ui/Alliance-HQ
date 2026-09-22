// One-off maintenance script: deletes an auth user by Chief ID so they can sign up again.
// Usage: node scripts/reset-test-user.mjs <chiefId>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const chiefId = process.argv[2];
if (!chiefId) {
  console.error("Usage: node scripts/reset-test-user.mjs <chiefId>");
  process.exit(1);
}

const email = `${chiefId}@chiefid.alliance-hq.internal`;

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let page = 1;
let found = null;
while (!found) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  found = data.users.find((u) => u.email === email);
  if (found || data.users.length < 200) break;
  page += 1;
}

if (!found) {
  console.log(`No account found for Chief ID ${chiefId} (${email}). Nothing to do.`);
  process.exit(0);
}

const { error: deleteError } = await supabase.auth.admin.deleteUser(found.id);
if (deleteError) throw deleteError;

console.log(`Deleted account for Chief ID ${chiefId}. You can sign up again now.`);
