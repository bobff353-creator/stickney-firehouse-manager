import { cookies } from "next/headers";
import AuthGateway from "../auth-gateway";

export default async function InventoryRoute(){
  const cookieStore=await cookies();
  return <AuthGateway initiallyVerified={cookieStore.get("__Secure-firehouse-access")?.value==="verified"} initialPage="Inventory"/>;
}
