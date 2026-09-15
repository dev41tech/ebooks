import { sessionAccess } from "./lib/access";
import SambuApp from "./sambu-app";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { user, admin, participant } = await sessionAccess();
  return <SambuApp user={user ? { name: user.displayName, email: user.email, admin, participant } : null} />;
}
