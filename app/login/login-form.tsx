"use client";

import { useState } from "react";
import { authErrorMessage } from "../lib/auth-messages";

type Mode = "login" | "signup";

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "signup" && password !== confirmation) {setError("As senhas não coincidem.");return;}
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, displayName }),
      });
      const parsed = await response.json().catch(() => null);
      const data = (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}) as {
        ok?: boolean;
        error?: string;
        requestId?: string;
        confirmationRequired?: boolean;
      };

      if (!response.ok) {
        setError(authErrorMessage(data.error, response.status, data.requestId));
        return;
      }
      if (data.ok !== true) {
        setError(authErrorMessage("auth_invalid_response", 502));
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
          {mode === "login" ? "LEITORES BETA" : "SUA CONTA BETA"}
        </p>
        <h1>{mode === "login" ? "Seu próximo capítulo começa aqui." : "Faça parte da comunidade Sambu."}</h1>
        <p className="beta-login-intro">Entre para guardar seus livros e continuar de onde parou, no celular ou computador. Participação gratuita no Beta.</p>

        {mode === "signup" && (
          <label>
            Nome
            <input
              type="text"
              required
              maxLength={120}
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

        {mode === "signup" && <label>Confirmar senha<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/><small>Use pelo menos 8 caracteres. Guarde sua senha para voltar à sua biblioteca.</small></label>}
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
            setPassword("");
            setConfirmation("");
          }}
        >
          {mode === "login"
            ? "Criar minha conta Beta"
            : "Já tenho conta, quero entrar"}
        </button>
        <a className="beta-login-back" href="/">← Voltar ao acervo</a>
      </form>
    </main>
  );
}
