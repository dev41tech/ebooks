import {apiFetch} from './client-api';
export function trackReading(event:'reader_opened'|'reader_open_failed'|'chapter_load_failed'|'sync_failed',bookId:string){
  void apiFetch('/api/analytics',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,bookId}),keepalive:true}).catch(()=>{});
}
