/**
 * Toda a cópia do assistente num lugar só.
 * Os textos vêm fechados do handoff de design — não reescrever sem passar por G&G.
 */

export const BATERITO_COPY = {
  /** Balão de convite do FAB. "Baterito" sai destacado em verde na renderização. */
  fabHintPrefix: "Alguma dúvida? Fala com o ",
  fabHintName: "Baterito",
  fabLabel: "Abrir o assistente Baterito",
  fabLabelClose: "Fechar o assistente Baterito",
  badgeCount: "1",

  panelLabel: "Assistente Baterito",
  headerKicker: "Assistente virtual · IA",
  headerName: "Baterito",
  headerStatus: "online",
  resetLabel: "Nova conversa",
  closeLabel: "Fechar",

  greeting:
    "Oi! Eu sou o Baterito, assistente do portal.\nPergunta o que quiser sobre benefícios, férias, documentos e vagas internas — eu procuro nos materiais oficiais de Gente & Gestão e te respondo com a fonte.",

  sourceLabel: "Fonte",
  suggestionsLabel: "Pergunte assim",
  typingLabel: "Baterito está digitando",

  inputPlaceholder: "Manda sua dúvida sem cerimônia…",
  inputLabel: "Escreva sua pergunta",
  sendLabel: "Enviar",

  disclaimer:
    "Uso interno. Nada de CPF, telefone pessoal, endereço, documentos ou dados bancários por aqui. Respostas geradas por IA — em caso de dúvida, confirme com Gente & Gestão.",

  errorText: "Deu ruim aqui do meu lado e não consegui responder. Tenta de novo?",
  retryLabel: "Tentar de novo",
} as const;

/** Chips iniciais. Clicar envia o texto como se o colaborador tivesse digitado. */
export const BATERITO_SUGGESTIONS = [
  "Quantos dias de férias eu tenho?",
  "Como funciona o convênio?",
  "Onde vejo meu holerite?",
  "Quais vagas internas estão abertas?",
] as const;
