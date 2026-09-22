import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS entirely. Only use it from code that has
// already verified the caller is allowed to see the data (e.g. the owner
// inbox), never from anything reachable by an ordinary org member.
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
