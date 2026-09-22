'use client';
import {useState} from 'react';
import {apiFetch} from '../lib/client-api';
export default function PilotPreparation(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 return <section className="beta-report"><h3>Preparar o piloto</h3><p>Comece com 3 leitores durante 48 horas. Após conferir cadastro, leitura e retomada no celular, amplie para até 20 participantes.</p><ol><li>Escolha 5 livros revisados e confira suas autorizações de distribuição.</li><li>Baixe uma cópia dos dados e arquivos antes do início. Evite editar ou importar livros durante a cópia.</li><li>Compartilhe o link e o <a href="/?view=guide">guia para leitores</a> apenas com o grupo escolhido. O link atual não bloqueia o acesso por e-mail.</li></ol><button className="outline" disabled={busy} onClick={async()=>{
 setBusy(true);setMessage('Preparando os dados e arquivos. Mantenha esta página aberta.');setError('');
 try{const response=await apiFetch('/api/admin/backup',{method:'POST'});
 if(!response.ok){const data=await response.json() as {error?:string};throw new Error(data.error==='owner_master_required'||response.status===403?'Entre como proprietário e desbloqueie a administração com a senha master para baixar o backup.':data.error==='backup_missing_file'?'Há um arquivo referenciado que não foi encontrado. A cópia foi interrompida para não gerar um backup incompleto.':data.error==='backup_limit'?'O acervo excedeu o limite desta exportação do beta. Solicite ao operador um backup completo da hospedagem.':'Não foi possível preparar a cópia. Tente novamente.');}
 const blob=await response.blob();const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Sambu-backup-${new Date().toISOString().slice(0,10)}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage('Arquivo preparado para download. Confirme que ele foi salvo e guarde-o em local privado. A restauração de produção ainda precisa ser validada.');
 }catch(e){setMessage('');setError((e as Error).message);}finally{setBusy(false);}
 }}>{busy?'Preparando backup…':'Baixar backup de dados e acervo'}</button><p className="feedback-note">Exclusivo do proprietário com senha master. Inclui cadastro, progresso, avaliações e arquivos vinculados. Contém dados pessoais: guarde fora do acesso público. Não inclui senhas, sessões, configurações da hospedagem nem código-fonte. O download não é um backup automático.</p>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
