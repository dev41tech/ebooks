const messages:Record<string,string>={
 storage_dir_missing:'Configure STORAGE_DIR=/app/storage e monte um volume persistente nesse caminho no Easypanel. Depois implante novamente.',
 storage_dir_invalid:'STORAGE_DIR deve apontar para uma pasta com caminho absoluto, como /app/storage.',
 storage_dir_unavailable:'A pasta dos livros não existe. Confira o volume montado no caminho de STORAGE_DIR e implante novamente.',
 storage_dir_access_denied:'O aplicativo não tem permissão para acessar a pasta dos livros. Ajuste as permissões do volume para o usuário sambu (UID 1001).',
 storage_disk_unavailable:'Não foi possível acessar o disco dos livros. Confira o volume no Easypanel e a referência nos logs.',
 storage_url_missing:'Configure SUPABASE_URL em Ambiente no Easypanel e implante novamente.',
 storage_url_invalid:'Confira SUPABASE_URL em Ambiente no Easypanel: use apenas a URL do projeto Supabase.',
 storage_key_missing:'Falta a chave de armazenamento. Configure SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY em Ambiente no Easypanel e implante novamente.',
 storage_key_invalid:'A chave de armazenamento é inválida. Confira a chave secret ou service_role do mesmo projeto Supabase no Easypanel; não use a chave pública.',
 storage_bucket_missing:'O bucket de livros não foi encontrado. Confira SUPABASE_STORAGE_BUCKET no Easypanel e crie esse bucket privado no Storage do Supabase, se necessário. O padrão é sambu.',
 storage_bucket_invalid:'Confira o nome do bucket em SUPABASE_STORAGE_BUCKET no Easypanel.',
 storage_access_denied:'O Supabase recusou o acesso aos arquivos. Confira a chave secret ou service_role e as permissões do bucket.',
 storage_unavailable:'A VPS não conseguiu conectar ao armazenamento. Confira SUPABASE_URL e se o projeto Supabase está ativo e acessível.',
 storage_timeout:'O armazenamento demorou para responder. Tente novamente; se persistir, confira a conexão da VPS com o Supabase.',
 storage_file_too_large:'O limite de arquivo do bucket Supabase é menor que o livro enviado. Ajuste o limite no Storage antes de tentar novamente.',
 storage_type_not_allowed:'O bucket recusou o tipo de arquivo. Permita application/json, application/octet-stream e application/epub+zip nas configurações do Storage.',
 storage_object_missing:'Um arquivo do envio não foi encontrado. Tente a importação novamente.',
 storage_busy:'O armazenamento está ocupado. Aguarde um momento e tente novamente.',
 storage_provider_error:'O armazenamento recusou a operação. Consulte nos logs do Easypanel a referência abaixo.',
 storage_invalid_response:'A URL configurada não retornou uma resposta válida do Storage. Confira SUPABASE_URL no Easypanel.',
 import_server_error:'O servidor não concluiu a importação. Consulte nos logs do Easypanel a referência abaixo.',
};
export function importErrorMessage(data:{error?:unknown;requestId?:unknown},fallback:string){
 const message=typeof data.error==='string'&&messages[data.error]||fallback;
 const reference=typeof data.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(data.requestId)?` Referência: ${data.requestId}.`:'';
 return message+reference;
}
