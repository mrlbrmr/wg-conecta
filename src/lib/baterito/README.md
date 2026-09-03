# Assistente Baterito

FAB + painel de conversa do Portal do Colaborador. O componente mora em
`src/components/baterito/` e é montado no `PortalLayout` — o painel administrativo está em outra
árvore de rotas e nunca o vê.

## Como a resposta é montada

1. `client.ts` (navegador) chama `POST /api/baterito` com o bearer da sessão Supabase.
2. `src/routes/api/baterito.ts` valida o token, aplica o rate limit, mascara PII e busca a base.
3. `knowledge.server.ts` chama `baterito_search()` — busca full-text sobre o que o portal
   publica: documentos de G&G (`faq_items`, `benefits`, `documents`, `gg_pages`,
   `internal_jobs`, `quick_links`, `forms`, `monthly_deadlines`, `contacts`) e a vida do
   portal (`announcements`, `campaigns`, `culture_events`, `recognitions`,
   `onboarding_materials`), mais três documentos agregados montados na hora a partir de
   `employee_directory`: aniversariantes do mês, tempo de casa do mês e novas admissões dos
   últimos 60 dias.
4. O modelo recebe só esses trechos e o prompt de `prompt.ts`. Sem trecho, não há chamada ao
   modelo: o assistente encaminha para o G&G e registra a lacuna.
5. A resposta volta como SSE (`{type:"text"}` por pedaço, `{type:"done"}` com as fontes) e a
   bolha cresce enquanto o texto chega.

**Não existe base de conhecimento separada.** Publicar conteúdo para o Baterito é publicar
conteúdo no portal, pelo painel de sempre.

## Variáveis de ambiente

| Variável                                    | Onde               | Para quê                                                     |
| ------------------------------------------- | ------------------ | ------------------------------------------------------------ |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | servidor           | validar o token e ler a base                                 |
| `GOOGLE_GENERATIVE_AI_API_KEY`              | servidor           | chave da Gemini API, do Google AI Studio                     |
| `BATERITO_MODEL`                            | servidor, opcional | troca o modelo sem passar por PR. Padrão: `gemini-3.5-flash` |

## Provedor e custo

Gemini pelo Google AI Studio, no **tier gratuito**. O AI Gateway da Vercel foi descartado: ele
exige cartão cadastrado até para liberar os créditos grátis e devolvia 403 em toda pergunta.

Duas consequências que valem lembrar:

- **O tier gratuito do Google usa o conteúdo enviado para treinar os modelos, e revisores
  humanos podem ler entradas e saídas.** Aqui trafegam as perguntas dos colaboradores, trechos
  dos documentos internos de G&G e — desde que o corpus passou a cobrir a vida do portal —
  **nomes de colaboradores** com dia de aniversário, data de admissão, cargo e unidade, além dos
  contatos de G&G. É o mesmo conjunto que a view `employee_directory` já expõe a qualquer
  colaborador logado, mas aqui ele sai da empresa. Escolha consciente; migrar para o tier pago
  tira o treinamento e a revisão humana.
- O tier gratuito tem limite de requisições por minuto e por dia. Estourado o limite, a chamada
  falha e o colaborador vê a mensagem de "não consegui montar a resposta agora" — não a de base
  vazia.

Nem todo modelo do catálogo está liberado no tier gratuito. Se `gemini-3.5-flash` não estiver,
troque pela env `BATERITO_MODEL` — `gemini-3.6-flash`, `gemini-3.7-flash` e
`gemini-3.5-flash-lite` são alternativas.

## Quando ele responde a mesma coisa para tudo

As duas falhas possíveis têm textos diferentes de propósito:

| O que aparece na bolha                                             | O que está acontecendo                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| "Essa eu não achei nos materiais que tenho aqui…"                  | a busca voltou vazia — falta conteúdo publicado no portal sobre o assunto                     |
| "Achei o material aqui, mas não consegui montar a resposta agora." | a busca achou, o modelo é que não respondeu — chave ausente, crédito acabado ou provedor fora |

Para o primeiro caso, rode a consulta de conferência de `baterito_search()` em
`supabase/MIGRATIONS.md`. Para o segundo, comece pelas variáveis de ambiente.

## Privacidade

- A conversa vive no `localStorage` do navegador, chaveada pelo id do usuário autenticado.
  Ela não é gravada no banco.
- `baterito_queries` guarda uma linha por pergunta — com a PII já mascarada por `pii.ts` — para o
  rate limit e para o relatório de lacunas. Só admin lê, por RLS.
- O mascaramento é rede de segurança, não garantia: padrões ambíguos (agência e conta, por
  exemplo) passam. O aviso do composer continua sendo a primeira linha de defesa.
