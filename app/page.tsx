import { getUser } from "./auth";
import SambuApp from "./sambu-app";
export const dynamic = "force-dynamic";
export default async function Home(){const user=await getUser();return <SambuApp user={user?{name:user.displayName,email:user.email}:null}/>}
