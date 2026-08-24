# Arquitetura — Sambu Online

O MVP usa um monólito modular em Next.js/Vinext, com renderização no servidor e componentes interativos no cliente. O banco D1 mantém dados relacionais e progresso; mídia futura será isolada em R2. A autenticação usa a identidade segura do ambiente ChatGPT, sem senhas próprias no MVP.

```mermaid
flowchart TD
  A[Web responsiva] --> B[Next.js / BFF]
  B --> C[Catálogo e Reader]
  B --> D[Identidade]
  B --> E[Analytics]
  C --> F[(D1)]
  D --> F
  E --> F
  C -. capas e áudio .-> G[(R2 futuro)]
```

Decisões: monólito modular primeiro; progresso vinculado à identidade e validado no servidor; dados fictícios de demonstração; preferências visuais locais e progresso persistente; sem segredos no cliente.
