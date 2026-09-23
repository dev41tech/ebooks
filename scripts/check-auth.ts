import {fileURLToPath} from "node:url";
import {AuthServiceError, supabaseAuth} from "../app/lib/auth-service";

/** Read-only probe: no signup, login, user email, password or mail is sent. */
export async function checkAuth() {
  try {
    const settings = await supabaseAuth("settings", undefined, "GET");
    const external = settings.external as {email?: unknown} | undefined;
    if (typeof settings.disable_signup !== "boolean" || typeof external?.email !== "boolean") {
      throw new AuthServiceError("auth_invalid_response", 502, "invalid_settings");
    }
    return {
      ok: true,
      connection: "ok",
      emailSignup: settings.disable_signup || !external.email ? "disabled" : "enabled",
      emailConfirmation: typeof settings.mailer_autoconfirm === "boolean" ? settings.mailer_autoconfirm ? "disabled" : "enabled" : "unknown",
      note: "Consulta de configuração concluída. Não cria contas nem testa o envio de e-mails.",
    };
  } catch (error) {
    const failure = error instanceof AuthServiceError ? error : new AuthServiceError("auth_internal_error", 500, "unexpected_exception");
    return {ok: false, error: failure.code, reason: failure.reason, upstreamStatus: failure.upstreamStatus};
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await checkAuth();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
