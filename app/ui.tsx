// Peças de UI compartilhadas entre a vitrine (sambu-app) e as telas de produção
// (studio-ia). Ficam num módulo próprio para os dois lados usarem sem import
// circular.
"use client";

export function Icon({ name }: { name: string }) {
  const g: Record<string, string> = {
    search: "⌕",
    home: "⌂",
    book: "▤",
    headphones: "◉",
    user: "○",
    bell: "◌",
    play: "▶",
    lock: "▣",
    spark: "✦",
    upload: "↥",
    edit: "✎",
    megaphone: "◄",
  };
  return <span aria-hidden="true">{g[name] || "•"}</span>;
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  children,
  required = false,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  children?: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {children || <input name={name} type={type} placeholder={placeholder} />}
      <small>{hint || name}</small>
    </label>
  );
}
