# Migrations pendentes — handoff do Portal do Colaborador

## Pendentes (PR `feat/acesso-cpf`)

Login por CPF + senha para quem não tem e-mail corporativo. Duas coisas antes de usar:

**1. Migration** (depois das de `feat/ajustes-pos-testes`, logo abaixo):

| Arquivo | O que faz |
|---|---|
| `20260915130000_employee_cpf_logins.sql` | Cria `employee_cpf_logins`: quem entra por CPF, com o HMAC do CPF e os dois últimos dígitos. Só o servidor lê. |

**2. Segredo `CPF_LOGIN_PEPPER` na Vercel** (Settings → Environment Variables, marcar Production
e Preview). É a chave do HMAC: o CPF nunca é gravado, só o resultado do HMAC com ela. Gere um
valor aleatório no PowerShell (vai direto para a área de transferência, sem aparecer na tela):

```powershell
$b = New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) | Set-Clipboard
```

Cole na Vercel e faça um novo deploy. **Não troque esse valor depois do primeiro acesso por CPF
criado**: com outro segredo, nenhum CPF cadastrado consegue entrar (seria preciso recriar todos
os acessos). Guarde uma cópia num cofre de senhas.

Sem a migration e o segredo, o resto do portal funciona normalmente; só o login por CPF responde
"indisponível".

**Uso:** Colaboradores → ⋯ → Dar acesso → **Por CPF**. O painel mostra uma senha provisória uma
única vez, para entregar à pessoa; no primeiro acesso ela cria a própria. Esqueceu a senha:
⋯ → Gerar nova senha. CPF digitado errado: ⋯ → Corrigir CPF.

## Pendentes (PR `feat/ajustes-pos-testes`)

Rodar no SQL Editor do projeto **`wrldlvcrrslzbrwuwdsr`**, **um arquivo por vez, na ordem, antes
do deploy** do PR. Se as pendências do P1 e do P2, logo abaixo, ainda não rodaram, elas vêm
primeiro (a ordem é a do nome do arquivo):

| Arquivo | O que faz |
|---|---|
| `20260915120000_portal_settings_track_toggle.sql` | Cria `portal_settings.onboarding_track_enabled`, o interruptor "Trilha de integração ativa" de Configurações. Sem ela, salvar Configurações dá erro. |
| `20260915120100_directory_public_job_title.sql` | A view `employee_directory` passa a devolver o cargo sem senioridade (Jr, Pleno, Sênior, I/II/III…). O cadastro não muda. |
| `20260915120200_employees_unit_from_department.sql` | Move a filial gravada em `department` para `unit`, com o nome oficial, e deixa o setor vazio para a próxima importação preencher. |

**Antes da terceira, confira o que ela vai mover** (só leitura):

```sql
SELECT department, unit, count(*) FROM public.employees WHERE active GROUP BY 1, 2 ORDER BY 3 DESC;
```

Toda linha em que `department` é uma das seis filiais (Campinas, Maringá, Nova Iguaçu, São
Bernardo do Campo, São José dos Pinhais, São Paulo) vai ter a filial copiada para `unit` e o
`department` esvaziado. Se aparecer filial escrita de um jeito que a migration não reconhece
(ex.: "Matriz"), me avise antes de rodar.

**Depois da segunda, confira os cargos** (só leitura):

```sql
SELECT DISTINCT e.job_title AS no_cadastro, d.job_title AS no_portal
FROM public.employees e JOIN public.employee_directory d ON d.id = e.id
WHERE e.job_title IS DISTINCT FROM d.job_title
ORDER BY 1;
```

Se algum cargo perdeu mais do que o nível, a view volta ao que era rodando de novo o bloco da
view de `20260911130000_employees_hide_birthday.sql`.

**Depois do deploy:**
- Reimportar a planilha do DP com a coluna **Setor** (ou Departamento/Área). A importação só
  completa campos vazios, então é ela que preenche o `department` que a terceira migration
  esvaziou. Até lá, "Colegas da área" no Perfil fica vazio para quem ficou sem setor.
- A trilha fica ligada por padrão. Para desligar: Configurações → Integração.

## Pendentes (PR `fix/p1-aniversario-e-endurecimento`)

Rodar no SQL Editor do projeto **`wrldlvcrrslzbrwuwdsr`**, **um arquivo por vez, na ordem**:

| Arquivo | O que faz |
|---|---|
| `20260911130000_employees_hide_birthday.sql` | Cria `employees.hide_birthday` ("Não exibir aniversário no portal"). A view `employee_directory` passa a devolver o aniversário vazio para quem estiver marcado, e a pessoa some da home, da Cultura, do KPI e do Baterito. |
| `20260911140000_storage_photo_extension.sql` | A foto do colaborador em `employee-photos/` passa a aceitar só JPG, PNG, WEBP e AVIF. |

A migration de `hide_birthday` precisa rodar **antes do deploy** do PR. O painel já lê e grava a
coluna, e sem ela a tela de Colaboradores dá erro. Depois do deploy, marque "Não exibir
aniversário no portal" em Colaboradores → editar → Dados pessoais.

## Pendentes (PR `fix/p2-escritas-pelo-servidor`)

Rodar depois das duas de cima, também um arquivo por vez. Nenhuma delas depende de deploy: dá
para rodar antes ou depois do merge.

| Arquivo | O que faz |
|---|---|
| `20260911150000_self_writes_via_server.sql` | Remove as policies de escrita "próprio registro" pela API REST: solicitações, mensagens, atualização cadastral, reconhecimentos, comentários, reações, parabéns e `employees`. Toda escrita do colaborador já passa pelo servidor. A leitura não muda. |
| `20260911160000_retention_and_attachment_limits.sql` | Apaga `baterito_queries` com mais de 90 dias e agenda a limpeza diária, se o `pg_cron` estiver habilitado. O bucket `request-attachments` passa a aceitar só PDF, JPG e PNG de até 10 MB. |
| `20260911170000_hygiene.sql` | Apaga a tabela `portal_access`, que guardava o código compartilhado antigo, e restringe as leituras de conteúdo a `authenticated`. |

Para conferir a primeira, rode à parte. Deve voltar só as policies de admin e as de leitura:

```sql
SELECT tablename, policyname, cmd FROM pg_policies
 WHERE schemaname = 'public' AND cmd <> 'SELECT'
   AND tablename IN ('requests','request_messages','profile_update_requests','peer_recognitions',
                     'announcement_comments','announcement_reactions','anniversary_congrats',
                     'announcement_reads','onboarding_progress','material_views','employees')
 ORDER BY 1, 2;
```

## Resolvido (11/09/2026): colaboradores com acesso de admin

Os blocos A a D abaixo foram rodados e conferidos no portal em 11/09/2026:
- `admin_users` limpo;
- `20260911120000_undo_setup_completo.sql` aplicada;
- `write_auth` removidas;
- `employees` voltou a ter só o UPDATE por coluna.

O texto fica como registro e para conferências futuras.

Em uso real, colaboradores viram as solicitações uns dos outros. A causa provável é a da seção
"Antes de aplicar: conferir quem é admin", logo abaixo: a limpeza de `admin_users` nunca rodou.
Quem está lá como ativo passa em `requests_admin_all`, lê todas as solicitações pela API **e
entra no painel `/admin`**, onde vê telefone, nascimento, férias e atestados de todo mundo.

O PR `fix/p0-isolamento-por-colaborador` já faz "Meus envios" filtrar pelo colaborador no
servidor, mesmo para admin. Mas o acesso ao painel só fecha com a limpeza. Tudo abaixo roda no
SQL Editor do projeto **`wrldlvcrrslzbrwuwdsr`** (o do `.env`).

> O SQL Editor executa **tudo** o que está no editor e mostra só o resultado da última
> consulta. Rode um bloco por vez: selecione o trecho antes de apertar Run.

**Situação em 11/09/2026:**
- A limpeza de `admin_users` rodou junto com um roteiro anterior. Ela deixa ativos só os três
  e-mails do rodapé (Julliana, Murilo e Yasmin) e desativa os demais com `active = false`, sem
  apagar nenhuma linha. Confirme com o bloco A.
- As `*_write_auth` existiam, porque o `setup_completo.sql` foi rodado depois das migrations. A
  correção é `migrations/20260911120000_undo_setup_completo.sql` (bloco C).
- O Baterito foi usado por uma conta só. Não há conta compartilhada.

**A) Quem é admin** (só leitura):

```sql
SELECT a.email, a.name, a.active, a.updated_at,
       EXISTS (SELECT 1 FROM public.employees e WHERE e.auth_user_id = a.id) AS e_colaborador
  FROM public.admin_users a
 ORDER BY a.active DESC, a.updated_at DESC;
```

Para devolver o painel a alguém do G&G:

```sql
UPDATE public.admin_users SET active = true, updated_at = now() WHERE email = '...';
```

**B) Políticas abertas** (só leitura). Depois do bloco C, deve voltar vazio:

```sql
SELECT tablename, policyname FROM pg_policies WHERE policyname LIKE '%write\_auth%';
```

**C) Correção:** cole e rode o arquivo `migrations/20260911120000_undo_setup_completo.sql`
inteiro. Ele é idempotente.

**D) Conferência de `employees`** (só leitura). Depois do bloco C, `authenticated` deve ter
`UPDATE` só nas colunas `bio`, `extension`, `email`, `photo_url` e `updated_at`. A lista abaixo
deve voltar vazia:

```sql
SELECT privilege_type FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'employees' AND grantee = 'authenticated'
   AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
```

As 12 migrations com prefixo `20260903*` **ainda não foram aplicadas**. Elas foram escritas no
ambiente de desenvolvimento, que não tem a CLI do Supabase nem a `SUPABASE_SERVICE_ROLE_KEY`.
Enquanto não rodarem, as telas novas (`/perfil`, `/mural`, `/cultura`) carregam o layout mas não
encontram as tabelas.

## Antes de aplicar: conferir quem é admin

A migration `20260903120000_roles_hardening.sql` derruba o trigger `on_auth_user_created_admin`,
que inseria **toda** nova linha de `auth.users` em `admin_users` com `active = true`. Como
`app_private.is_admin()` é exatamente "existe em `admin_users` e está ativo", todo colaborador
convidado para o portal virou admin.

Derrubar o trigger impede novos casos, mas **não desfaz os já criados**. Rode a consulta abaixo e
confira a lista antes de desativar qualquer linha:

```sql
SELECT a.id, a.email, a.active,
       EXISTS (SELECT 1 FROM public.employees e WHERE e.auth_user_id = a.id) AS e_colaborador
FROM public.admin_users a
ORDER BY a.email;
```

Depois, desative só quem não é de Gente & Gestão:

```sql
UPDATE public.admin_users SET active = false WHERE email IN ( ... );
```

## Ordem de aplicação

As duas migrations `20260902*` vieram do fluxo de atualização cadastral e rodam antes. As desta
entrega foram renumeradas para `20260903*` justamente para não disputar prefixo com elas.

Os arquivos são idempotentes e devem rodar na ordem do nome:

| Arquivo                                      | O que faz                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `20260903120000_roles_hardening.sql`         | derruba o trigger de admin automático; cria `app_private.current_employee_id()`                    |
| `20260903120100_employees_profile.sql`       | `bio`, `unit`, `extension`, `manager_id`, `buddy_id`; UPDATE por coluna; view `employee_directory` |
| `20260903120200_peer_recognitions.sql`       | reconhecimento entre colegas                                                                       |
| `20260903120300_mural_interactions.sql`      | leituras, reações e comentários; `lead`/`author_*`/`headline`; CHECK no status                     |
| `20260903120400_requests.sql`                | `requests` + `request_messages` + `forms.sla_days`                                                 |
| `20260903120500_onboarding.sql`              | checklist, progresso e materiais vistos                                                            |
| `20260903120600_culture.sql`                 | fotos, calendário e "dar parabéns"                                                                 |
| `20260903120700_gg_vagas.sql`                | prazos do mês, benefícios em destaque, campos da vaga                                              |
| `20260903120800_audit_log.sql`               | log de auditoria do painel                                                                         |
| `20260903120900_storage_employee_photos.sql` | colaborador escreve em `employee-photos/<id>`                                                      |
| `20260903121000_portal_reads.sql`            | leitura de `contacts` para autenticados                                                            |
| `20260903121100_employees_co_manager.sql`    | `co_manager_id` (segundo gestor) + view atualizada                                                 |

Com a CLI:

```bash
supabase link --project-ref wrldlvcrrslzbrwuwdsr
supabase db push
```

Sem a CLI, cole o conteúdo dos arquivos, **na ordem**, no SQL Editor do painel do Supabase.

## Formulários internos — `20260904120000_form_submissions.sql` (aplicada)

Os três formulários de Gente & Gestão saíram do Google Forms e passaram a ser preenchidos dentro
do portal. A migration:

- dá `slug` a `forms` (formulário interno) e torna `external_url` opcional; aponta os três
  registros semeados para `ferias`, `atualizacao-cadastral` e `solicitacao-geral`;
- acrescenta `payload jsonb`, `priority` e `attachment_path` a `requests`;
- acrescenta `employees.registration_number` (matrícula) — **fora** do GRANT UPDATE por coluna,
  porque é dado do DP e fica somente-leitura para o colaborador;
- cria o bucket privado `request-attachments`, com escrita restrita à pasta do próprio
  colaborador e leitura só para o dono ou o G&G.

### Situação conferida em 03/09/2026

Checagem via API contra o projeto que está no `.env` (`wrldlvcrrslzbrwuwdsr`). Esta página
citava `icllhgvhuzhhlxwlqwtt`, que está desatualizado; foi corrigido em 11/09/2026. O
`project_id` de `supabase/config.toml` é só o nome do ambiente local da CLI e não aponta para o
projeto remoto:

- `requests`, `request_messages`, `profile_update_requests` e `employees` **existem** — as
  migrations `20260903*` já foram aplicadas neste projeto, ao contrário do que esta página dizia;
- depois de aplicar esta migration, `requests.payload`, `requests.priority`,
  `requests.attachment_path` e `employees.registration_number` respondem 200, e os três cartões do
  catálogo passaram a navegar para `/formularios/<slug>` em vez de abrir link externo;
- `GET /rest/v1/forms` com a chave publicável devolve `permission denied for function is_admin`:
  a policy de leitura de `forms` chama `app_private.is_admin()` e o role `anon` não tem `EXECUTE`
  nela. É anterior a esta entrega e não aparece na tela, porque o portal exige login — mas vale
  conferir se `authenticated` tem o grant.

## Depois de aplicar

`src/integrations/supabase/types.ts` é um arquivo **gerado**, mas foi editado à mão porque já
estava defasado (faltavam `auth_user_id`, `phone`, `birth_date`, `admission_date` e `photo_url` em
`employees`, o que produzia 25 erros de tipo). Regenere assim que a CLI estiver disponível:

```bash
supabase gen types typescript --project-id wrldlvcrrslzbrwuwdsr > src/integrations/supabase/types.ts
```

## Dado de exemplo

As telas novas leem de tabelas vazias e caem nos estados vazios. Para ver a Integração e os
Formulários funcionando, cadastre pelo painel:

- alguns itens em **Trilhas de integração** (`onboarding_checklist_items`);
- `sla_days` nos formulários existentes;
- algumas linhas em **Prazos do mês** (`monthly_deadlines`).

## Gestões — `supabase/gestoes.sql`

Script gerado da planilha `Empregados.xlsx` do DP (abas Empregados e PJ, só quem está ATIVO):
135 colaboradores, 30 deles com dois gestores diretos.

Rode **depois** das migrations e **depois de cadastrar IGOR ASTORI** como colaborador — ele é
gestor direto de 23 pessoas mas não aparece em nenhuma aba da planilha.

O script tem três blocos. O **BLOCO 1 só confere** e lista quem não casou por nome; resolva o que
aparecer antes de seguir. O BLOCO 2 grava, e só para quem casou dos dois lados. O BLOCO 3 mostra o
resultado e a hierarquia inteira.

O casamento é por nome normalizado (minúsculo, sem acento, espaços comprimidos). A planilha usa
nome curto para o gestor ("ALINE POPENDA") e nome completo para o colaborador; a resolução para
nome completo já foi feita na geração do script — 18 dos 19 gestores resolveram sem ambiguidade.

A coluna `GESTÃO` da planilha (Igor Astori, Paulo Scachetti, Aline Popenda, Katiane Andreata) é um
segundo nível acima do gestor direto e **não** foi cadastrada.

## Assistente Baterito — `20260905120000_baterito.sql` (aplicada)

Aplicada em 03/09/2026. Cria a função `baterito_search()` (busca full-text no conteúdo já
publicado do portal) e a tabela `baterito_queries` (rate limit + lista de perguntas que a base
não respondeu). Depende da extensão `unaccent`, criada pela própria migration no schema
`extensions`.

**Pendente: regenerar os tipos.** Enquanto isso não acontece, `src/lib/baterito/db.server.ts` é a
ponte que mantém o TypeScript compilando — o `Database` gerado ainda não conhece a tabela nem a
função. Use o project-ref do `.env` (`wrldlvcrrslzbrwuwdsr`), não o das seções acima:

```bash
supabase gen types typescript --project-id wrldlvcrrslzbrwuwdsr > src/integrations/supabase/types.ts
```

Aí `db.server.ts` pode sair e as duas chamadas voltam a usar `supabaseAdmin` direto.

### Conferir a busca

O assistente só responde o que a base cobre. Vale rodar antes de liberar para o time:

```sql
SELECT source, title, url, round(rank::numeric, 4) AS rank
  FROM public.baterito_search('quantos dias de ferias eu tenho', 8);
```

Se vier vazio para as perguntas mais comuns (férias, convênio, holerite, vagas), o problema é
falta de conteúdo publicado — não da função. É esse o trabalho que `baterito_queries` mede.

### Retenção

O handoff pede 90 dias de retenção. Não há job agendado: se o projeto tiver `pg_cron`, agende

```sql
SELECT cron.schedule('baterito-retencao', '0 4 * * *',
  $$DELETE FROM public.baterito_queries WHERE created_at < now() - interval '90 days'$$);
```

Sem `pg_cron`, rode o `DELETE` manualmente de tempos em tempos.

### Lacunas de conteúdo

A consulta que interessa ao time de G&G:

```sql
SELECT question, count(*) AS vezes, max(created_at) AS ultima
  FROM public.baterito_queries
 WHERE NOT answered AND created_at > now() - interval '30 days'
 GROUP BY question
 ORDER BY vezes DESC, ultima DESC
 LIMIT 20;
```

## Baterito: busca com OU — `20260906120000_baterito_busca_ou.sql`

Correção da função criada acima. `websearch_to_tsquery` combina os termos com **AND**: "Como
tirar o holerite?" virava `'tir' & 'holerit'` e exigia que o documento contivesse as duas coisas.
Nenhum material de G&G diz "tirar", então a busca voltava vazia para quase tudo e o assistente
caía no encaminhamento sempre — parecendo que a base não existia.

Agora os lexemas são combinados com `|` e o `ts_rank` ordena: quem casa mais termos sobe.

Para confirmar antes e depois, no SQL Editor:

```sql
-- Antes da correção isto volta 0 linhas; depois, os documentos de holerite.
SELECT source, title, url, round(rank::numeric, 4) AS rank
  FROM public.baterito_search('Como tirar o holerite?', 8);
```

Se **continuar vazio depois da correção**, o problema é conteúdo: não há nada publicado sobre o
assunto nas tabelas do portal. Confira o que existe:

```sql
SELECT 'faq' AS tabela, count(*) FROM public.faq_items WHERE active
UNION ALL SELECT 'beneficios', count(*) FROM public.benefits WHERE active
UNION ALL SELECT 'documentos', count(*) FROM public.documents WHERE active
UNION ALL SELECT 'paginas_gg', count(*) FROM public.gg_pages WHERE active
UNION ALL SELECT 'vagas', count(*) FROM public.internal_jobs WHERE status <> 'encerrada'
UNION ALL SELECT 'atalhos', count(*) FROM public.quick_links WHERE active
UNION ALL SELECT 'formularios', count(*) FROM public.forms WHERE active
UNION ALL SELECT 'prazos', count(*) FROM public.monthly_deadlines WHERE active
UNION ALL SELECT 'contatos', count(*) FROM public.contacts WHERE active;
```

## Baterito: corpus com a vida do portal — `20260907120000_baterito_corpus_cultura.sql`

O corpus deixa de ser só documento de G&G e passa a cobrir também comunicados publicados,
campanhas ativas, eventos de cultura, reconhecimentos e materiais de integração.

Aniversariantes, tempo de casa e novas admissões entram como **documentos agregados** — um por
assunto, montado na hora com o recorte do mês, e não uma linha por pessoa. A pergunta
("quem faz aniversário este mês") é temporal, não lexical: busca full-text sobre 135 fichas nunca
responderia isso, mas um documento cujo título é "Aniversariantes de setembro" responde. De
quebra, só quem é do mês chega ao modelo, em vez do diretório inteiro.

A origem é `employee_directory`, a view que o portal já usa — sem e-mail, sem telefone, sem data
de nascimento completa.

Para conferir:

```sql
SELECT source, title, url FROM public.baterito_search('quais são os aniversariantes do mês', 8);
SELECT source, title, url FROM public.baterito_search('quem completa tempo de casa', 8);
SELECT source, title, url FROM public.baterito_search('quem entrou agora na empresa', 8);
SELECT source, title, url FROM public.baterito_search('quais campanhas estão ativas', 8);
SELECT source, title, url FROM public.baterito_search('contatos do G&G', 8);
```

Os agregados só aparecem quando há gente no recorte: se ninguém faz aniversário no mês corrente,
aquele documento não existe e o assistente encaminha em vez de inventar uma lista vazia.
