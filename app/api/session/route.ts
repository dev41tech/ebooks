import { sessionAccess } from "../../lib/access";
export async function GET() {
  const {user,admin,participant,adminTrial,temporaryAdmin}=await sessionAccess();
  return Response.json({user:user?{name:user.displayName,email:user.email,admin,participant,adminTrial,temporaryAdmin}:null},{headers:{"Cache-Control":"no-store"}});
}
