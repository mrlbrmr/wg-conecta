# Assistente Baterito

FAB + painel de conversa do Portal do Colaborador. O componente mora em
`src/components/baterito/` e é montado no `PortalLayout` — o painel administrativo está em outra
árvore de rotas e nunca o vê.

## Como a resposta é montada

1. `client.ts` (navegador) chama `POST /api/baterito` com o bearer da sessão Supabase.
2. `src/routes/api/baterito.ts` valida o token, aplica o rate limit, mascara PII e busca a base.
3. `knowledge.server.ts` chama `baterito_search()` — busca full-text sobre o conteúdo que o time
   de G&G já publica pelo painel (`faq_items`, `benefits`, `documents`, `gg_pages`,
   `internal_jobs`, `quick_links`, `forms`, `monthly_deadlines`, `contacts`).
4. O modelo recebe só esses trechos e o prompt de `prompt.ts`. Sem trecho, não há chamada ao
   modelo: o assistente encaminha para o G&G e registra a lacuna.
5. A resposta volta como SSE (`{type:"text"}` por pedaço, `{type:"done"}` com as fontes) e a
   bolha cresce enquanto o texto chega.

**Não existe base de conhecimento separada.** Publicar conteúdo para o Baterito é publicar
conteúdo no portal, pelo painel de sempre.

## Variáveis de ambiente

| Variável                                    | Onde     | Para quê                                                                            |
| ------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | servidor | validar o token e ler a base                                                        |
| `AI_GATEWAY_API_KEY`                        | servidor | AI Gateway da Vercel. Em deploys na Vercel o token OIDC do projeto dispensa a chave |

O modelo está em `MODEL`, no topo do endpoint. É uma string `provedor/modelo` do AI Gateway —
trocar por um mais barato é mudar essa linha.

## Custo

O Gateway não cobra markup sobre tokens: paga-se o preço de lista do provedor. Com ~2.000 tokens
de contexto e ~200 de resposta por pergunta, o custo fica na casa de poucos dólares por mil
perguntas. Dá para acompanhar e limitar em Budgets, no painel do AI Gateway.

## Privacidade

- A conversa vive no `localStorage` do navegador, chaveada pelo id do usuário autenticado.
  Ela não é gravada no banco.
- `baterito_queries` guarda uma linha por pergunta — com a PII já mascarada por `pii.ts` — para o
  rate limit e para o relatório de lacunas. Só admin lê, por RLS.
- O mascaramento é rede de segurança, não garantia: padrões ambíguos (agência e conta, por
  exemplo) passam. O aviso do composer continua sendo a primeira linha de defesa.
