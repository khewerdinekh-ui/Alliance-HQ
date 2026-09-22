import EventAttendancePage from "@/components/EventAttendancePage";

export default async function FoundryPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  return <EventAttendancePage eventType="foundry" selectedEventId={event} />;
}
