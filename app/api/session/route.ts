import { sessionAccess } from "../../lib/access";
export async function GET() {
  const {user,admin,participant}=await sessionAccess();
  return Response.json({user:user?{name:user.displayName,email:user.email,admin,participant}:null},{headers:{"Cache-Control":"no-store"}});
}
