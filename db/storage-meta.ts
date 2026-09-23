/**
 * Partes do armazenamento que independem de onde os bytes ficam: validação da
 * chave e os metadados do usuário, que vivem no Postgres desde a saída do R2.
 *
 * Extraído de storage.ts quando o driver de disco entrou. Duplicar as três
 * queries no driver novo funcionaria hoje e apodreceria depois — uma mudança de
 * schema pegaria um dos dois e passaria em silêncio pelo outro.
 */
import {database} from './sql';

/**
 * Chave de objeto válida. Serve aos dois drivers, por motivos diferentes: no
 * Supabase evita montar uma URL absurda; **no disco é a fronteira de segurança**,
 * porque `..` numa chave escreveria fora da pasta de armazenamento.
 */
export function assertStorageKey(key:string){
 if(!key||key.startsWith('/')||key.includes('\\')||key.includes('\0')||key.split('/').some(x=>x==='.'||x==='..'))throw new Error('invalid_storage_key');
 return key;
}

export async function readCustomMetadata(key:string){
 const row=await database.prepare('SELECT metadata FROM storage_metadata WHERE key=?').bind(key).first<{metadata:Record<string,string>}>();
 return row?.metadata||{};
}

export async function writeCustomMetadata(key:string,metadata:Record<string,string>){
 await database.prepare('INSERT INTO storage_metadata(key,metadata,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET metadata=excluded.metadata,updated_at=excluded.updated_at').bind(key,JSON.stringify(metadata),new Date().toISOString()).run();
}

export async function deleteCustomMetadata(key:string){
 await database.prepare('DELETE FROM storage_metadata WHERE key=?').bind(key).run();
}
