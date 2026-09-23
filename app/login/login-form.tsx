"use client";

import { useState } from "react";

type Mode = "login" | "signup";

const messages: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  invalid_credentials_format:
    "Informe um e-mail válido e uma senha de pelo menos 8 caracteres.",
  signup_failed: "Não foi possível criar a conta.",
  invalid_origin:
    "O acesso está indisponível neste endereço. Avise a administração do Sambu.",
};

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, displayName }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        confirmationRequired?: boolean;
      };

      if (!response.ok) {
        setError(messages[data.error || ""] || data.error || "Erro inesperado.");
        return;
      }
      if (data.confirmationRequired) {
        setNotice(
          "Conta criada. Confirme o e-mail pelo link que enviamos e depois entre.",
        );
        setMode("login");
        return;
      }
      window.location.href = returnTo;
    } catch {
      setError("Não foi possível conectar ao Sambu. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span>S</span>
          <b>Sambu</b>
        </div>
        <p className="eyebrow coral">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </p>
        <h1>Histórias que ficam em você.</h1>

        {mode === "signup" && (
          <label>
            Nome
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}

        <label>
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>

        {error && <p className="login-error" role="alert">{error}</p>}
        {notice && <p className="login-notice" role="status">{notice}</p>}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>

        <button
          className="ghost"
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "login"
            ? "Não tenho conta ainda"
            : "Já tenho conta, quero entrar"}
        </button>
      </form>
    </main>
  );
}
