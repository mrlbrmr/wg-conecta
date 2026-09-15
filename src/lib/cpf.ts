/**
 * CPF como identificador de login — para quem não tem e-mail corporativo (motoristas,
 * logística, operação).
 *
 * O CPF nunca é gravado: o servidor guarda só um HMAC dele (com um segredo que fica fora do
 * banco) e os dois últimos dígitos, para o G&G reconhecer o cadastro. A conta no Auth usa um
 * e-mail sintético derivado do HMAC, num domínio sem caixa postal — nenhum e-mail é enviado.
 */

export const CPF_LOGIN_DOMAIN = "cpf.wgbaterias.com.br";

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** CPF com os dois dígitos verificadores corretos. Sequências repetidas não valem. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** "123.456.789-09" enquanto a pessoa digita. */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** O que o painel mostra de um CPF cadastrado: só os dois últimos dígitos. */
export function hiddenCpf(last2: string): string {
  return `•••.•••.•••-${last2}`;
}

/** A conta do Auth é de login por CPF (e-mail sintético)? */
export function isCpfLoginEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${CPF_LOGIN_DOMAIN}`));
}
