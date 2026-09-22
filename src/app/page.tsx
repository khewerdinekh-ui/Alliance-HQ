import { redirect } from "next/navigation";

// Force dynamic rendering so this redirect is never statically cached at the
// CDN edge — it must always be re-evaluated (middleware decides where
// unauthenticated / no-org users actually land).
export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/members");
}
