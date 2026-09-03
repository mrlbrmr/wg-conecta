# Migrations pendentes — handoff do Portal do Colaborador

As 11 migrations com prefixo `20260903*` **ainda não foram aplicadas**. Elas foram escritas no
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

Com a CLI:

```bash
supabase link --project-ref icllhgvhuzhhlxwlqwtt
supabase db push
```

Sem a CLI, cole o conteúdo dos arquivos, **na ordem**, no SQL Editor do painel do Supabase.

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
