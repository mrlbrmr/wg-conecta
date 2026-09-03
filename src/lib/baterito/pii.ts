/**
 * Mascaramento de PII antes de a pergunta ser gravada em `baterito_queries`.
 *
 * O aviso do composer pede para ninguém mandar CPF, telefone ou dados
 * bancários — mas alguém vai mandar. O registro de perguntas existe para o time
 * de G&G descobrir lacunas de conteúdo, não para virar um depósito de dado
 * pessoal, então a pergunta é higienizada antes de sair da memória do servidor.
 */

// A ordem importa: o padrão mais longo e mais específico primeiro, senão o
// começo de um cartão é lido como CPF e o resto sobra solto no texto.
const PATTERNS: { re: RegExp; mask: string }[] = [
  // Cartão: 13 a 19 dígitos, com ou sem separador. Começa e termina em dígito,
  // para não engolir o espaço que separa da próxima palavra.
  { re: /\b\d(?:[ .-]?\d){12,18}\b/g, mask: "[cartão]" },
  { re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{2}\b/g, mask: "[cnpj]" },
  { re: /\b\d{3}\.\d{3}\.\d{3}-?\d{2}\b/g, mask: "[cpf]" },
  // Telefone com DDD, fixo ou celular, com ou sem +55. Os lookarounds impedem
  // que o padrão comece no meio de uma sequência maior de dígitos e deixe o
  // primeiro dígito de um CPF solto no texto.
  { re: /(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)/g, mask: "[telefone]" },
  // Onze dígitos crus são CPF ou celular sem formatação — não dá para saber
  // qual, e o rótulo vai para um relatório que gente lê. Fica neutro.
  { re: /\b\d{11}\b/g, mask: "[dado pessoal]" },
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, mask: "[email]" },
];

/** Devolve a pergunta com os padrões sensíveis substituídos por um rótulo. */
export function maskPII(text: string): string {
  return PATTERNS.reduce((acc, { re, mask }) => acc.replace(re, mask), text);
}

/** `true` se a mensagem carregava algum dado que não devia estar aqui. */
export function hasPII(text: string): boolean {
  return maskPII(text) !== text;
}
