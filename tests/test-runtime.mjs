import {createHash} from 'node:crypto';
export const env={};
export const identity={email:null,cookie:'',temporary:false};
let runtime;
export function initialize(value){runtime=value;env.DB=value.database;env.BUCKET=makeBucket();}
export function getDatabase(){return runtime.database;}
export async function getDb(){return runtime.orm;}
export async function getUser(){return identity.email?{id:identity.email,email:identity.email,displayName:identity.email,temporary:identity.temporary}:null;}
export async function headers(){return new Headers(identity.cookie?{cookie:identity.cookie}:{});}
export function redirect(){throw new Error('unexpected_redirect');}
function makeBucket(){
 const objects=new Map();
 const info=value=>({size:value.bytes.length,etag:value.etag,httpEtag:`"${value.etag}"`,customMetadata:value.options.customMetadata||{},httpMetadata:value.options.httpMetadata||{},writeHttpMetadata(headers){if(value.options.httpMetadata?.contentType)headers.set('content-type',value.options.httpMetadata.contentType);}});
 return {
  async put(key,body,options={}){const bytes=new Uint8Array(await new Response(body).arrayBuffer());const value={bytes,options,etag:createHash('sha256').update(bytes).digest('hex')};objects.set(key,value);return info(value);},
  async head(key){const v=objects.get(key);return v?info(v):null;},
  async get(key,options={}){const v=objects.get(key);if(!v||options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==v.etag)return null;const bytes=options.range?v.bytes.slice(options.range.offset,options.range.offset+options.range.length):v.bytes;return {...info(v),body:new Response(bytes).body,arrayBuffer:async()=>bytes.slice().buffer,text:async()=>new TextDecoder().decode(bytes)};},
  async delete(key){objects.delete(key);}
 };
}
export const bucket=new Proxy({},{get(_target,name){const value=env.BUCKET[name];return typeof value==='function'?value.bind(env.BUCKET):value;}});
export const database={prepare:(...args)=>env.DB.prepare(...args)};
