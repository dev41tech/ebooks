// Cria ou atualiza a senha de um usuário da autenticação local.
//
// Existe porque o primeiro login é um problema de galinha e ovo: sem conta
// ninguém entra, e a tela de cadastro depende do app já estar acessível. Este
// script fala direto com o Postgres.
//
//   node scripts/criar-usuario.mjs email@exemplo.com "Nome Exibido"
//
// A senha NÃO vem por argumento: argumento de linha de comando fica no
// histórico do shell e aparece na lista de processos da máquina. Ela é pedida
// pelo terminal, sem eco, ou lida de SAMBU_NEW_PASSWORD para uso automatizado.
//
// Se o e-mail já existir, a senha é trocada e TODAS as sessões abertas daquele
// usuário são derrubadas.
//
// Ser admin não vem daqui: continua saindo de SAMBU_ADMIN_EMAILS (ou
// ADMIN_EMAILS) no ambiente do app.
import 'dotenv/config';
import {createInterface} from 'node:readline';
import postgres from 'postgres';
import {randomBytes, randomUUID, scrypt} from 'node:crypto';
import {promisify} from 'node:util';

const scryptAsync=promisify(scrypt);
const COST={N:32768,r:8,p:1};
const MAXMEM=64*1024*1024;
const MIN=8;

const [email,displayName='']=process.argv.slice(2);
if(!email||!email.includes('@')){
 console.error('Uso: node scripts/criar-usuario.mjs email@exemplo.com "Nome Exibido"');
 process.exit(1);
}
if(!process.env.DATABASE_URL){
 console.error('DATABASE_URL não definida.');
 process.exit(1);
}

async function pedirSenha(){
 if(process.env.SAMBU_NEW_PASSWORD)return process.env.SAMBU_NEW_PASSWORD;
 const rl=createInterface({input:process.stdin,output:process.stdout,terminal:true});
 // Sem eco: a senha não fica na tela nem no scrollback do terminal.
 const escrever=rl._writeToOutput?.bind(rl);
 rl._writeToOutput=function(texto){if(escrever&&!/^\s*$/.test(texto)&&texto.includes('Senha'))escrever(texto);};
 const senha=await new Promise(resolve=>rl.question('Senha (não será exibida): ',resolve));
 rl.close();
 process.stdout.write('\n');
 return senha;
}

const senha=await pedirSenha();
if(senha.length<MIN){
 console.error(`A senha precisa ter pelo menos ${MIN} caracteres.`);
 process.exit(1);
}

const salt=randomBytes(16);
const derivado=await scryptAsync(senha,salt,32,{...COST,maxmem:MAXMEM});
const hash=['scrypt',COST.N,COST.r,COST.p,salt.toString('base64'),derivado.toString('base64')].join('$');

const sql=postgres(process.env.DATABASE_URL,{max:1});
try{
 const normalizado=email.trim().toLowerCase();
 const agora=new Date().toISOString();
 const [existente]=await sql`select email from auth_users where email = ${normalizado}`;
 if(existente){
  await sql`update auth_users set password_hash = ${hash}, updated_at = ${agora} where email = ${normalizado}`;
  const derrubadas=await sql`delete from auth_sessions where user_email = ${normalizado}`;
  console.log(`senha atualizada: ${normalizado} (${derrubadas.count} sessão(ões) encerrada(s))`);
 }else{
  await sql`insert into auth_users (email, display_name, password_hash, created_at, updated_at)
            values (${normalizado}, ${String(displayName).trim().slice(0,120)}, ${hash}, ${agora}, ${agora})`;
  console.log(`usuário criado: ${normalizado}`);
 }
 console.log('Para dar acesso de admin, inclua esse e-mail em SAMBU_ADMIN_EMAILS no EasyPanel.');
}finally{
 await sql.end();
}
