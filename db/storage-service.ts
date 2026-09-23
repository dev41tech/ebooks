/** Server-only transport. Provider bodies, URLs and credentials never leave this module. */
export class StorageServiceError extends Error {
 constructor(public code:string,public status:number,public reason:string,public upstreamStatus?:number){super(code);}
}
export function storageConfig(){
 const rawUrl=process.env.SUPABASE_URL?.trim();
 const key=process.env.SUPABASE_SECRET_KEY?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 const bucket=process.env.SUPABASE_STORAGE_BUCKET?.trim()||'sambu';
 if(!rawUrl)throw new StorageServiceError('storage_url_missing',503,'missing_supabase_url');
 if(!key)throw new StorageServiceError('storage_key_missing',503,'missing_server_key');
 let url:URL;
 try{url=new URL(rawUrl);}catch{throw new StorageServiceError('storage_url_invalid',503,'invalid_supabase_url');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!/^\/*$/.test(url.pathname))throw new StorageServiceError('storage_url_invalid',503,'invalid_supabase_url');
 if(/[^\x21-\x7e]/.test(key)||key.startsWith('sb_publishable_'))throw new StorageServiceError('storage_key_invalid',503,'invalid_server_key');
 if(/[/\\\x00-\x1f]/.test(bucket))throw new StorageServiceError('storage_bucket_invalid',503,'invalid_bucket_name');
 return {url:url.origin,key,bucket};
}
function transportError(error:unknown){
 const value=error as {name?:string;cause?:{code?:string}};
 if(['TimeoutError','AbortError'].includes(value?.name||''))return new StorageServiceError('storage_timeout',504,'timeout');
 const reason=value?.cause?.code;
 const allowed=['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT'];
 return new StorageServiceError('storage_unavailable',503,reason&&allowed.includes(reason)?reason:'network_error');
}
export async function storageFetch(path:string,method:string,headers:Record<string,string>={},body?:BodyInit,timeout=120000){
 const config=storageConfig();
 try{
  return await fetch(config.url+'/storage/v1/'+path,{
   method,headers:{apikey:config.key,...(!config.key.startsWith('sb_secret_')?{authorization:'Bearer '+config.key}:{}),...headers},
   ...(body!==undefined?{body,duplex:'half'}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeout),
  } as RequestInit);
 }catch(error){throw transportError(error);}
}
export async function storageResponseError(response:Response,resource:'object'|'bucket'='object'){
 let data:Record<string,unknown>={};
 try{data=await response.json();}catch{/* Empty HEAD and proxy responses are valid failure cases. */}
 const code=typeof data?.code==='string'?data.code:'';
 const message=typeof data?.message==='string'?data.message:'';
 const error=typeof data?.error==='string'?data.error:'';
 // Legacy Storage uses HTTP 400 with a 404 statusCode; never treat all 400s as missing files.
 if(code==='NoSuchBucket'||message==='Bucket not found'||(resource==='bucket'&&response.status===404))return new StorageServiceError('storage_bucket_missing',503,'bucket_not_found',response.status);
 if(code==='NoSuchKey'||message==='Object not found'||(resource==='object'&&response.status===404))return new StorageServiceError('storage_object_missing',404,'object_not_found',response.status);
 if(response.status===401||['InvalidJWT','InvalidSignature','SignatureDoesNotMatch'].includes(code)||/^(Invalid API key|Invalid JWT|invalid signature)$/i.test(message))return new StorageServiceError('storage_key_invalid',503,'api_key_rejected',response.status);
 if(response.status===403||code==='AccessDenied'||error==='Unauthorized')return new StorageServiceError('storage_access_denied',503,'access_denied',response.status);
 if(response.status===413||code==='EntityTooLarge')return new StorageServiceError('storage_file_too_large',413,'provider_size_limit',response.status);
 if(code==='InvalidMimeType'||/mime type .* is not supported/i.test(message))return new StorageServiceError('storage_type_not_allowed',422,'provider_type_limit',response.status);
 if(response.status===429||code==='SlowDown')return new StorageServiceError('storage_busy',503,'provider_rate_limit',response.status);
 return new StorageServiceError('storage_provider_error',502,'provider_rejection',response.status);
}
/** Read-only preflight, before uploading any book. Does not create or change a bucket. */
export async function checkStorage(){
 const {bucket}=storageConfig();
 const response=await storageFetch('bucket/'+encodeURIComponent(bucket),'GET',{},undefined,15000);
 if(!response.ok)throw await storageResponseError(response,'bucket');
 let data;
 try{data=await response.json();}catch{throw new StorageServiceError('storage_invalid_response',502,'invalid_bucket_response');}
 if(!data||data.id!==bucket)throw new StorageServiceError('storage_invalid_response',502,'invalid_bucket_response');
 return {ready:true};
}
