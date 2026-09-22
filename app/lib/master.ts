import { env } from "cloudflare:workers";
import { headers } from "next/headers";
export const MASTER_COOKIE = "__Host-sambu-master";
export const SESSION_SECONDS = 7200;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");
export const randomSecret = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt:encoder.encode(salt), iterations:100000 }, key, 256));
}
export function equalHash(a:string,b:string) {
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
export async function masterToken() {
  const value=(await headers()).get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(MASTER_COOKIE+"="))?.slice(MASTER_COOKIE.length+1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function masterUnlocked(email:string) {
  const token=await masterToken();if(!token)return false;
  const row=await env.DB.prepare("SELECT email FROM master_sessions WHERE token_hash=? AND email=? AND expires_at>?").bind(await digest(token),email,Date.now()).first();
  return !!row;
}
export function masterCookie(token:string,maxAge=SESSION_SECONDS) {
  return `${MASTER_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
