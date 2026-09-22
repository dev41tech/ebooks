import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {zipSync,strToU8} from 'fflate';
const directory=await mkdtemp(join(tmpdir(),'sambu-transfer-'));
await build({entryPoints:['app/lib/catalog-transfer.ts'],outfile:join(directory,'transfer.mjs'),bundle:true,platform:'node',format:'esm'});
const {inspectCatalogBackup,extractBackupBook}=await import(pathToFileURL(join(directory,'transfer.mjs')));
after(()=>rm(directory,{recursive:true,force:true}));
const row={id:'source-1',slug:'source-one',title:'Original title',author:'Author',genre:'Romance',format:'EPUB',description:'Original description',status:'published',epub_key:'imports/one.epub',featured:1,subscribers_only:0,free_chapters:1,published_at:'2026-09-01',created_at:'2026-08-31'};
const file=strToU8('file bytes');
function backup(rows=[row],assets={'assets/imports/one.epub':file}){
 return zipSync({'snapshot.json':strToU8(JSON.stringify({format:'sambu-pilot-backup-v1',tables:{books:rows,profiles:[{email:'private@example.test',role:'admin'}]},assets:[{key:row.epub_key,size:file.length}]})),...assets});
}
test('catalog ZIP includes only published books and preserves metadata and ebook bytes',()=>{
 const bytes=backup([row,{...row,id:'deleted',slug:'deleted',status:'deleted'}]);
 const items=inspectCatalogBackup(bytes);
 assert.equal(items.length,1);assert.equal(items[0].book.featured,true);assert.equal(items[0].book.subscribersOnly,false);
 assert.equal(items[0].book.title,row.title);assert.equal('profiles' in items[0],false);
 assert.deepEqual(extractBackupBook(bytes,items[0]),file);
});
test('catalog ZIP refuses missing files, duplicated IDs, unsafe paths and unsupported formats',()=>{
 assert.throws(()=>inspectCatalogBackup(backup([row],{})),/missing_book_file/);
 assert.throws(()=>inspectCatalogBackup(backup([row,row])),/duplicate_book/);
 assert.throws(()=>inspectCatalogBackup(backup([row],{'../private':file})),/invalid_backup/);
 assert.throws(()=>inspectCatalogBackup(backup([{...row,format:'PDF'}])),/unsupported_catalog/);
 assert.throws(()=>inspectCatalogBackup(backup([{...row,cover_key:'cover.png'}])),/unsupported_catalog/);
});
test('classification from PostgreSQL backups remains attached to the book',()=>{
 const [item]=inspectCatalogBackup(backup([{...row,category_main:'literatura',categories_secondary:['romance']} ]));
 assert.equal(item.book.categoryMain,'literatura');assert.deepEqual(item.book.categoriesSecondary,['romance']);
});
