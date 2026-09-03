# Migrations pendentes — handoff do Portal do Colaborador

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

| Arquivo | O que faz |
|---|---|
| `20260903120000_roles_hardening.sql` | derruba o trigger de admin automático; cria `app_private.current_employee_id()` |
| `20260903120100_employees_profile.sql` | `bio`, `unit`, `extension`, `manager_id`, `buddy_id`; UPDATE por coluna; view `employee_directory` |
| `20260903120200_peer_recognitions.sql` | reconhecimento entre colegas |
| `20260903120300_mural_interactions.sql` | leituras, reações e comentários; `lead`/`author_*`/`headline`; CHECK no status |
| `20260903120400_requests.sql` | `requests` + `request_messages` + `forms.sla_days` |
| `20260903120500_onboarding.sql` | checklist, progresso e materiais vistos |
| `20260903120600_culture.sql` | fotos, calendário e "dar parabéns" |
| `20260903120700_gg_vagas.sql` | prazos do mês, benefícios em destaque, campos da vaga |
| `20260903120800_audit_log.sql` | log de auditoria do painel |
| `20260903120900_storage_employee_photos.sql` | colaborador escreve em `employee-photos/<id>` |
| `20260903121000_portal_reads.sql` | leitura de `contacts` para autenticados |
| `20260903121100_employees_co_manager.sql` | `co_manager_id` (segundo gestor) + view atualizada |

Com a CLI:

```bash
supabase link --project-ref icllhgvhuzhhlxwlqwtt
supabase db push
```

Sem a CLI, cole o conteúdo dos arquivos, **na ordem**, no SQL Editor do painel do Supabase.

## Formulários internos — `20260904120000_form_submissions.sql` (pendente)

Os três formulários de Gente & Gestão saíram do Google Forms e passaram a ser preenchidos dentro
do portal. A migration:

- dá `slug` a `forms` (formulário interno) e torna `external_url` opcional; aponta os três
  registros semeados para `ferias`, `atualizacao-cadastral` e `solicitacao-geral`;
- acrescenta `payload jsonb`, `priority` e `attachment_path` a `requests`;
- acrescenta `employees.registration_number` (matrícula) — **fora** do GRANT UPDATE por coluna,
  porque é dado do DP e fica somente-leitura para o colaborador;
- cria o bucket privado `request-attachments`, com escrita restrita à pasta do próprio
  colaborador e leitura só para o dono ou o G&G.

Enquanto ela não rodar, `/formularios/<slug>` carrega mas o envio falha — as colunas não existem.

### Situação conferida em 03/09/2026

Checagem via API contra o projeto que está no `.env` (`wrldlvcrrslzbrwuwdsr`), que **não** é o
`icllhgvhuzhhlxwlqwtt` citado acima:

- `requests`, `request_messages`, `profile_update_requests` e `employees` **existem** — as
  migrations `20260903*` já foram aplicadas neste projeto, ao contrário do que esta página dizia;
- `requests.payload`, `requests.priority`, `requests.attachment_path` e
  `employees.registration_number` **não existem** — falta só a migration desta entrega;
- `GET /rest/v1/forms` com a chave publicável devolve `permission denied for function is_admin`:
  a policy de leitura de `forms` chama `app_private.is_admin()` e o role `anon` não tem `EXECUTE`
  nela. É anterior a esta entrega e não aparece na tela, porque o portal exige login — mas vale
  conferir se `authenticated` tem o grant.

Confirme o project-ref antes de aplicar qualquer coisa: o desta página está desatualizado.

## Depois de aplicar

`src/integrations/supabase/types.ts` é um arquivo **gerado**, mas foi editado à mão porque já
estava defasado (faltavam `auth_user_id`, `phone`, `birth_date`, `admission_date` e `photo_url` em
`employees`, o que produzia 25 erros de tipo). Regenere assim que a CLI estiver disponível:

```bash
supabase gen types typescript --project-id icllhgvhuzhhlxwlqwtt > src/integrations/supabase/types.ts
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
