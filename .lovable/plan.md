
# Portal do Colaborador WG — Plano do MVP

Portal interno leve, mobile-first, com identidade WG Baterias em tema claro (branco/off-white, verde institucional suave, dourado como destaque). Colaboradores acessam por link + código único; equipe de Gente & Gestão gerencia tudo em painel admin com login e-mail/senha.

## Escopo do MVP (nesta entrega)

**Área pública (colaborador)**
- Tela de acesso com código WG (armazenado no localStorage para não repetir).
- Home mobile-first: saudação, busca geral em destaque, comunicados importantes/fixados, avisos ativos, cards grandes com atalhos.
- Gente & Gestão: benefícios, documentos, dúvidas frequentes, férias, atestados, atualização cadastral, holerite (link), políticas, contatos.
- Comunicados oficiais + arquivo de comunicados (filtro por categoria/data).
- Vagas internas informativas (link para carreiras.wgbaterias.com.br).
- Integração (materiais editáveis: texto, imagem, anexo, link).
- Formulários (links externos categorizados).
- Cultura: aniversariantes, tempo de casa, reconhecimentos, campanhas.
- Busca geral em todos os conteúdos.
- Menu inferior no mobile, header no desktop.
- Rodapé com aviso de privacidade.

**Painel administrativo (/admin)**
- Login e-mail/senha via Lovable Cloud (Supabase Auth).
- Layout com menu lateral responsivo.
- Dashboard: cards com contagens (comunicados ativos/vencidos, docs, vagas abertas, campanhas, aniversariantes do mês, tempo de casa do mês).
- CRUD completo de todas as áreas listadas.
- Uploads de imagens/PDFs/planilhas via Supabase Storage (bloqueio de executáveis).
- Importação CSV/XLSX (aniversariantes e tempo de casa) com prévia e dedupe por nome+data.
- Configurações gerais: nome do portal, boas-vindas, logo, cor principal, código de acesso, contatos, aviso de privacidade, rodapé.
- Gestão de 4 usuários admin (criar, editar nome/e-mail, ativar/desativar, redefinir senha) — todos com mesmo nível.

**Dados iniciais (seed)** — Wellhub, Starbem, Ponto eletrônico, Holerite, exemplos de comunicado, FAQ, documento, vaga, formulário, campanha.

## Fora do escopo (fases futuras)
Login individual, comentários, curtidas, chat, aprovações, assinatura, candidatura interna, histórico de edição, organograma, galeria completa, push, checklist obrigatória de integração.

## Detalhes técnicos

**Stack:** TanStack Start + Tailwind v4 + shadcn + Lovable Cloud (Supabase: Auth, Postgres, Storage).

**Design system (src/styles.css):**
- Base off-white `#FAFAF7`, superfícies brancas.
- Verde WG suave (primário) — tom institucional derivado do site WG.
- Dourado/amarelo (accent/destaque para CTAs importantes, tags "importante").
- Cinzas leves para áreas secundárias, bordas suaves, sombras discretas, radius generoso (16–24px), tipografia moderna (Manrope/Plus Jakarta).
- Motion suave em cards e transições.

**Rotas públicas:**
```
/gate            → tela do código
/                → home
/gente-gestao    → hub
/gente-gestao/beneficios | /documentos | /faq | /ferias | /atestados
                 | /cadastro | /holerite | /politicas | /contatos
/comunicados          → ativos + fixados
/comunicados/arquivo  → histórico com busca
/comunicados/$id
/vagas
/integracao
/formularios
/cultura         (aniversariantes, tempo de casa, reconhecimentos, campanhas)
/busca?q=
```
Guard client-side lê `wg_access_ok` do localStorage; se ausente, redireciona para `/gate`.

**Rotas admin (sob `/_authenticated/admin`):**
Dashboard + uma página por recurso (comunicados, links rápidos, benefícios, documentos, FAQ, páginas de G&G, vagas, integração, formulários, aniversariantes, tempo de casa, reconhecimentos, campanhas, contatos, usuários admin, configurações, código de acesso).

**Schema Supabase (nomes conforme spec):**
`portal_settings`, `admin_users`, `quick_links`, `announcements`, `benefits`, `documents`, `faq_items`, `internal_jobs`, `onboarding_materials`, `forms`, `birthdays`, `work_anniversaries`, `recognitions`, `campaigns`, `contacts`, mais páginas simples de conteúdo (`gg_pages` para férias/atestados/cadastro/holerite/políticas — key/value editável).

**RLS:**
- Leitura pública (anon) para conteúdos ativos das tabelas do portal (benefícios/documentos/etc. com `active=true` ou `status='publicado'`). Isso mantém SSR/prerender funcionando; o "código de acesso" é uma barreira de UX no cliente, não segurança forte — a spec já aceita isso ("restrição simples").
- `portal_settings.employee_access_code_hash` NÃO é lido pelo cliente; validação do código é feita via server function que compara hash (bcrypt).
- Escrita apenas por `authenticated` (admins). `admin_users` gerenciada com `supabaseAdmin` em server functions protegidas.
- `service_role` full em todas as tabelas.

**Storage buckets:** `portal-public` (público — imagens, logos, anexos publicados); `portal-imports` (privado — planilhas temporárias).

**Server functions:**
- `verifyAccessCode(code)` → compara hash, retorna ok. Cliente salva `wg_access_ok=1` no localStorage.
- `setAccessCode(newCode)` (admin) → gera hash e salva.
- `createAdminUser`, `updateAdminUser`, `toggleAdminActive`, `resetAdminPassword` (usam `supabaseAdmin` com verificação de admin autenticado).
- `importBirthdays(rows)` / `importAnniversaries(rows)` com dedupe.
- Busca geral: `searchPortal(q)` faz `ilike` em campos-chave de cada tabela ativa e retorna resultados agrupados.

## Passos de implementação
1. Enable Lovable Cloud.
2. Migration com todas as tabelas + RLS + grants + buckets + seed inicial.
3. Design system + layout base (header público, menu inferior mobile, rodapé).
4. Tela `/gate` + guard.
5. Home + páginas públicas de conteúdo (lendo do Supabase).
6. Layout admin + auth + CRUDs (componente genérico de tabela+form reutilizado).
7. Configurações + código de acesso + usuários admin.
8. Importação CSV/XLSX.
9. Busca geral.
10. Polimento mobile, microinterações, aviso de privacidade.

## Após a entrega, você receberá
- Lista das tabelas criadas.
- Como criar os 4 usuários admin (via /admin/usuarios após primeiro admin bootstrap).
- Como alterar o código de acesso (Configurações → Código de acesso).
- Como cadastrar comunicados, documentos, benefícios, links rápidos.
- O que ficou preparado para expansão futura (checklist de integração, galeria, notificações).

## Observação importante
O MVP é grande. Vou construir em uma sequência longa mas coesa (pode consumir várias iterações). Confirme para eu iniciar habilitando o Lovable Cloud e criando o schema.
