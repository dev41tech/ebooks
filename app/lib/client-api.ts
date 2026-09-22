let apiOrigin = "";
/** The web keeps same-origin requests. Native builds configure a verified HTTPS API. */
export function configureApiOrigin(origin:string) {
  const url=new URL(origin);
  if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw new Error("A origem da API deve ser HTTPS, sem caminho ou credenciais.");
  apiOrigin=url.origin;
}
export function serviceUrl(path:string) {
  if(!path.startsWith("/")||path.startsWith("//"))throw new Error("Caminho de serviço inválido.");
  return `${apiOrigin}${path}`;
}
let refreshing:Promise<boolean>|null=null;
export async function apiFetch(path:string,options?:RequestInit) {
  const init={...options,credentials:apiOrigin?"include" as const:options?.credentials??"same-origin" as const};
  const response=await fetch(serviceUrl(path),init);
  if(response.status!==401||path==='/api/auth'||options?.body instanceof ReadableStream)return response;
  if(!refreshing)refreshing=fetch(serviceUrl('/api/auth'),{method:'POST',credentials:init.credentials,headers:{'content-type':'application/json'},body:JSON.stringify({action:'refresh'})}).then(r=>r.ok).catch(()=>false).finally(()=>{refreshing=null;});
  if(!await refreshing)return response;
  return fetch(serviceUrl(path),init);
}
