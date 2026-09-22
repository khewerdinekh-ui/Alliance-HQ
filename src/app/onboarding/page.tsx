import OnboardingClient from "./OnboardingClient";
import { getLocale } from "@/lib/i18n/getLocale";

export default async function OnboardingPage() {
  const locale = await getLocale();
  return <OnboardingClient initialLocale={locale} />;
}
