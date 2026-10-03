import AuthGateway from "./auth-gateway";
import { getPortalDepartment } from './department-portal';

export default async function Home() {
  return <AuthGateway department={await getPortalDepartment()} />;
}
