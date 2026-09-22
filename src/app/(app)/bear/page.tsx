import EventAttendancePage from "@/components/EventAttendancePage";

export default async function BearPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  return <EventAttendancePage eventType="bear" selectedEventId={event} />;
}
