import EventAttendancePage from "@/components/EventAttendancePage";

export default async function CanyonPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  return <EventAttendancePage eventType="canyon" selectedEventId={event} />;
}
