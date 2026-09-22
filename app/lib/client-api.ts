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
export function apiFetch(path:string,options?:RequestInit) {
  return fetch(serviceUrl(path),{...options,credentials:apiOrigin?"include":options?.credentials??"same-origin"});
}
