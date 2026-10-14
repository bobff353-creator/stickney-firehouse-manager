import Inventory360 from "../inventory-live";
import { InventoryAccessGate } from "../components/InventoryAccessGate";
import { verifyInventoryServerSession } from "../lib/inventory-session";
import SessionIdleLock from "../session-idle-lock";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ apparatus?: string; check?: string; adminTask?: string; equipment?: string; workOrder?: string; report?:string;view?:string }>;
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
        initialEquipmentId={typeof query.equipment==="string"?query.equipment.trim().slice(0,100):""}
        initialReportsView={query.view==='reports'}
        initialReportId={typeof query.report==="string"?query.report.trim().slice(0,100):""}
        initialWorkOrderId={typeof query.workOrder==="string"?query.workOrder.trim().slice(0,100):""}
        initialApparatusId={initialApparatusId}
        initialCheckType={initialCheckType}
        initialAdminTask={typeof query.adminTask === "string" ? query.adminTask : ""}
        permissions={session.context.grants}
      />
    </SessionIdleLock>
  );
}
