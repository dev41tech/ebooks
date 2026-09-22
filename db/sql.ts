import {getSql} from './index';

// Parameterized SQL shared by the beta endpoints. Values never become SQL text.
// Translate only placeholders/aliases outside SQL string literals.
export function postgresQuery(query:string){
 let i=0;
 return query.split(/('(?:''|[^'])*')/g).map((part,index)=>index%2?part:part.replace(/\?/g,()=>'$'+(++i)).replace(/\bAS\s+([a-zA-Z_][a-zA-Z_0-9]*)/gi,(_,name)=>'AS "'+name+'"')).join('');
}
type Result<T>={results:T[];meta:{changes:number}};
export type Executor=(query:string,params:unknown[])=>Promise<{rows:Record<string,unknown>[];count:number}>;
const numeric=new Set(['n','activeReaders','returningReaders','count','readers','advanced','completed','storyRating','textRating','ratings','reports','unresolved','created_at','expires_at','window_start']);
function normalize(row:Record<string,unknown>){
 return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,numeric.has(k)&&typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v)?Number(v):v]));
}
export class Statement {
 constructor(readonly query:string,readonly params:unknown[]=[],private executor?:Executor){}
 bind(...params:unknown[]){return new Statement(this.query,params,this.executor);}
 async all<T=Record<string,unknown>>():Promise<Result<T>>{
  const run=this.executor||executeSql;
  const r=await run(postgresQuery(this.query),this.params);
  return {results:r.rows.map(normalize) as T[],meta:{changes:r.count}};
 }
 async first<T=Record<string,unknown>>(){return (await this.all<T>()).results[0]??null;}
 async run(){return this.all();}
}
export const executeSql:Executor=async(query,params)=>{
 const rows=await getSql().unsafe(query,params as never[]);
 return {rows:rows as unknown as Record<string,unknown>[],count:rows.count};
};
export const database={
 prepare:(query:string)=>new Statement(query),
 async batch<T=Record<string,unknown>>(statements:Statement[]):Promise<Result<T>[]>{
  return await getSql().begin("isolation level repeatable read",async tx=>{
   const result:Result<T>[]=[];
   for(const statement of statements){
    const rows=await tx.unsafe(postgresQuery(statement.query),statement.params as never[]);
    result.push({results:rows.map(row=>normalize(row)) as T[],meta:{changes:rows.count}});
   }
   return result;
  }) as Result<T>[];
 }
};
