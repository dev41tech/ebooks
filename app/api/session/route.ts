import { sessionAccess } from "../../lib/access";
export async function GET() {
  const {user,admin,participant,adminTrial}=await sessionAccess();
  return Response.json({user:user?{name:user.displayName,email:user.email,admin,participant,adminTrial}:null},{headers:{"Cache-Control":"no-store"}});
}
