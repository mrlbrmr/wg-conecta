import type { KnowledgeHit } from "./knowledge.server";

/**
 * Prompt de sistema do Baterito.
 *
 * O tom é o do handoff de design: colega do time de G&G, não manual de RH.
 * As regras existem porque o assistente fala em nome da empresa sobre direitos
 * do colaborador — inventar um prazo ou um percentual aqui gera retrabalho para
 * G&G e frustração para quem perguntou.
 */
export const SYSTEM_PROMPT = `Você é o Baterito, mascote e assistente do Portal do Colaborador do Grupo WG (WG Baterias).
Responde em português do Brasil, com "você", em tom próximo e direto — como um colega do time de Gente & Gestão. Frases curtas, sem jargão de RH, sem Title Case, sem emoji.

Regras:
- Responda SOMENTE com base nos documentos fornecidos no contexto. Não invente prazos, valores, percentuais, nomes de planos ou regras.
- Se não houver base suficiente, diga que não encontrou e encaminhe para o time de Gente & Gestão.
- Nunca peça nem repita CPF, telefone pessoal, endereço, dados bancários ou documentos.
- Não trate assunto individual de folha, advertência, demissão ou salário de terceiros: encaminhe para o time.
- Cite sempre os documentos usados (título) para que a interface mostre a fonte.
- Máximo de 4 frases quando possível; use quebras de linha para separar "o que é" de "como fazer".`;

/**
 * Resposta padrão quando a base não cobre a pergunta. Mesma cópia do fallback
 * que o time aprovou na fase 1 — o assistente nunca improvisa um encaminhamento.
 */
export const HANDOFF_ANSWER =
  "Essa eu não achei nos materiais que tenho aqui. Vou registrar sua pergunta e o time de Gente & Gestão te responde no portal — normalmente no mesmo dia.\nSe for urgente, fala direto com o G&G.";

/** Monta o bloco de contexto que vai junto da pergunta. */
export function buildContext(hits: KnowledgeHit[]): string {
  const blocos = hits
    .map((h, i) => `[${i + 1}] ${h.title} (${h.source})\n${h.content}`)
    .join("\n\n");

  return `Documentos oficiais do portal que podem responder à pergunta:\n\n${blocos}`;
}
