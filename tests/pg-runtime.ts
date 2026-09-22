import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../db/schema';
import {Statement} from '../db/sql';
export function makeRuntime(pg:any){
 const executor=(client:any)=>async(query:string,params:unknown[])=>{const r=await client.query(query,params);return {rows:r.rows,count:r.affectedRows??r.rows.length};};
 return {orm:drizzle(pg,{schema}),database:{prepare:(q:string)=>new Statement(q,[],executor(pg)),batch:(statements:Statement[])=>pg.transaction(async(tx:any)=>{const out=[];for(const s of statements)out.push(await new Statement(s.query,s.params,executor(tx)).all());return out;})}};
}
