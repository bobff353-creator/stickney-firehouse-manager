import Inventory360 from "../inventory-live";
import { InventoryAccessGate } from "../components/InventoryAccessGate";
import { verifyInventoryServerSession } from "../lib/inventory-session";
import SessionIdleLock from "../session-idle-lock";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ apparatus?: string; check?: string }>;
}) {
  const session = await verifyInventoryServerSession();
  if (!session.ok) {
    return (
      <InventoryAccessGate
        unavailable={session.status === 503}
        message={session.error}
        status={session.status}
      />
    );
  }
  const query = await searchParams;
  const initialApparatusId = typeof query.apparatus === "string"
    ? query.apparatus.trim().slice(0, 80)
    : "";
  const initialCheckType = ["daily", "weekly", "inventory", "air_pack"].includes(query.check || "")
    ? query.check as "daily" | "weekly" | "inventory" | "air_pack"
    : "";
  return (
    <SessionIdleLock>
      <Inventory360
        departmentId={session.context.department.id}
        departmentName={session.context.department.name}
        initialApparatusId={initialApparatusId}
        initialCheckType={initialCheckType}
        permissions={session.context.grants}
      />
    </SessionIdleLock>
  );
}
