import {StorageServiceError} from '../../db/storage-service';

export async function withImportErrors(stage:string,action:()=>Promise<Response>){
 try{return await action();}catch(error){
  const known=error instanceof StorageServiceError;
  const requestId=crypto.randomUUID();
  const code=known?error.code:'import_server_error';
  const value=error as {code?:string;cause?:{code?:string}};
  const dbCode=value?.code||value?.cause?.code;
  const reason=known?error.reason:['42P01','42703','42501','23505','ECONNREFUSED','ETIMEDOUT','ENOTFOUND'].includes(dbCode||'')?dbCode:'unexpected_error';
  console.error(JSON.stringify({event:'sambu_import_error',requestId,stage,code,reason,...(known?{upstreamStatus:error.upstreamStatus}:{})}));
  return Response.json({error:code,requestId},{status:known?error.status:500,headers:{'Cache-Control':'private, no-store'}});
 }
}
