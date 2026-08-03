import { cookies } from "next/headers";
import AuthGateway from "./auth-gateway";

export default async function Home() {
  const cookieStore = await cookies();
  const recentlyVerified = cookieStore.get("__Secure-firehouse-access")?.value === "verified";
  return <AuthGateway initiallyVerified={recentlyVerified} />;
}
