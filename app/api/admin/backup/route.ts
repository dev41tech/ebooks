import {requireAccess} from '../../../lib/access';
import {masterUnlocked} from '../../../lib/master';
import {prepareBackup,streamBackup} from '../../../lib/pilot-backup';
export async function POST(request:Request){
 const access=await requireAccess('admin');if(access.error)return access.error;
 if(!access.ownerAdmin||!await masterUnlocked(access.user!.email))return Response.json({error:'owner_master_required'},{status:403});
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return Response.json({error:'invalid_origin'},{status:403});
 try{
  const prepared=await prepareBackup();
  return new Response(streamBackup(prepared),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="Sambu-backup-${new Date().toISOString().slice(0,10)}.zip"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){const reason=(error as Error).message;console.error('pilot_backup_failed',reason);return Response.json({error:['backup_limit','backup_missing_file'].includes(reason)?reason:'backup_failed'},{status:409});}
}
