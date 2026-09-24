import { connection } from "next/server";
import { getSystemStatus } from "@/app/lib/system-status-data";
import { SystemStatusCard } from "@/app/components/system-status-card";

export default async function StatusPage() {
  // Render per request: the status must reflect the live stack, not the
  // moment the image was built.
  await connection();
  const status = await getSystemStatus();
  return (
    <main className='flex min-h-dvh items-center justify-center p-6'>
      <SystemStatusCard status={status} />
    </main>
  );
}
