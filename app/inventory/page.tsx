import Inventory360 from "../inventory-live";
import { InventoryAccessGate } from "../components/InventoryAccessGate";
import { verifyInventoryServerSession } from "../lib/inventory-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await verifyInventoryServerSession();
  if (!session.ok) {
    return (
      <InventoryAccessGate
        unavailable={session.status === 503}
        message={session.error}
      />
    );
  }
  return (
    <Inventory360
      departmentId={session.context.department.id}
      departmentName={session.context.department.name}
    />
  );
}
