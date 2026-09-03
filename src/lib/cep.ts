/**
 * Consulta de CEP pelo ViaCEP.
 *
 * Conveniência de preenchimento, nunca fonte da verdade: o que vale é o que a
 * pessoa confirma na tela e o G&G aprova. Por isso qualquer falha — rede fora,
 * CEP inexistente, serviço lento — devolve `null` em silêncio e o formulário
 * segue no preenchimento manual.
 */

export interface AddressLookup {
  street: string;
  district: string;
  city: string;
  state: string;
}

/** Só os dígitos. "83000-000" e "83000000" são o mesmo CEP. */
export function cepDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isCompleteCep(value: string): boolean {
  return cepDigits(value).length === 8;
}

const TIMEOUT_MS = 4000;

export async function lookupCep(value: string): Promise<AddressLookup | null> {
  const cep = cepDigits(value);
  if (cep.length !== 8) return null;

  try {
    // O ViaCEP às vezes demora; sem timeout o campo ficaria "buscando" pra sempre.
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    // CEP inexistente volta 200 com `{ "erro": true }` — não é erro de rede.
    if (data.erro) return null;

    return {
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
