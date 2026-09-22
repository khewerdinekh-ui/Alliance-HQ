import BearAttendancePage from "@/components/BearAttendancePage";

export default async function BearPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  return <BearAttendancePage selectedEventId={event} />;
}
