const messages: Record<string, string> = {
  temporary_access_enabled: "O Sambu está temporariamente aberto. Acesse a página inicial para continuar sem login.",
  invalid_credentials: "E-mail ou senha incorretos.",
  invalid_credentials_format: "Informe um e-mail válido e uma senha de pelo menos 8 caracteres.",
  invalid_payload: "Confira os dados e tente novamente.",
  signup_failed: "Não foi possível concluir o cadastro. Tente novamente em instantes.",
  invalid_origin: "O acesso está indisponível neste endereço. Avise a administração do Sambu.",
  auth_not_configured: "O acesso ainda não foi configurado. Avise a administração do Sambu.",
  auth_config_invalid: "O serviço de acesso precisa de um ajuste de configuração pela administração do Sambu.",
  auth_unavailable: "Não foi possível conectar ao serviço de acesso. Tente novamente em instantes.",
  auth_timeout: "O serviço de acesso demorou a responder. Tente novamente em instantes.",
  auth_invalid_response: "O serviço de acesso não respondeu corretamente. Avise a administração do Sambu.",
  auth_upstream_error: "O serviço de cadastro e login está indisponível. Avise a administração do Sambu.",
  auth_internal_error: "O Sambu encontrou uma falha ao processar o acesso. Avise a administração.",
  email_not_confirmed: "Confirme seu e-mail pelo link recebido antes de entrar. Confira também a pasta de spam.",
  email_address_invalid: "Confira se o endereço de e-mail está correto.",
  email_address_not_authorized: "O envio de confirmação para novos leitores ainda precisa ser configurado pela administração.",
  email_exists: "Este e-mail já tem uma conta. Use a opção Entrar.",
  user_already_exists: "Este e-mail já tem uma conta. Use a opção Entrar.",
  signup_disabled: "Novos cadastros estão desativados. Avise a administração do Sambu.",
  email_provider_disabled: "O cadastro por e-mail está desativado. Avise a administração do Sambu.",
  weak_password: "Escolha uma senha mais forte, com letras maiúsculas e minúsculas, números e símbolos.",
  over_email_send_rate_limit: "O limite de e-mails de confirmação foi atingido. Aguarde antes de tentar novamente.",
  over_request_rate_limit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.",
  captcha_failed: "A verificação de segurança não foi concluída. Avise a administração do Sambu.",
  user_banned: "O acesso desta conta está suspenso. Entre em contato com a administração.",
};

export function authErrorMessage(code: unknown, status: number, requestId?: unknown) {
  const message = typeof code === "string" && Object.hasOwn(messages, code) ? messages[code] :
    status === 429 ? messages.over_request_rate_limit : status >= 500 ? messages.auth_upstream_error : messages.signup_failed;
  // Never display arbitrary provider text, HTML or credential-bearing error messages.
  const reference = typeof requestId === "string" && /^[a-f0-9-]{36}$/i.test(requestId) ? ` Referência: ${requestId}.` : "";
  return message + reference;
}
