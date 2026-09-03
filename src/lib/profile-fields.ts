/**
 * Campos que o colaborador pode pedir atualização pelo portal.
 *
 * Fonte única compartilhada entre a tela do colaborador, a tela admin de
 * solicitações e a validação nas server functions — a lista de chaves é a
 * whitelist do que pode ser gravado em `employees` na aprovação.
 */

export const PROFILE_FIELD_KEYS = [
  "name",
  "email",
  "phone",
  "birth_date",
  "marital_status",
  "education_level",
  "dependents",
  "address_zip",
  "address_street",
  "address_number",
  "address_complement",
  "address_district",
  "address_city",
  "address_state",
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

export type ProfileFieldInput = "text" | "email" | "tel" | "date" | "select" | "textarea";

export interface ProfileFieldDef {
  key: ProfileFieldKey;
  label: string;
  input: ProfileFieldInput;
  group: string;
  options?: string[];
  placeholder?: string;
  /** campo que não pode ficar vazio (employees.name é NOT NULL) */
  required?: boolean;
  /** largura no grid de 2 colunas do formulário */
  wide?: boolean;
}

export const MARITAL_STATUS_OPTIONS = [
  "Solteiro(a)",
  "Casado(a)",
  "União estável",
  "Divorciado(a)",
  "Separado(a)",
  "Viúvo(a)",
];

export const EDUCATION_OPTIONS = [
  "Fundamental incompleto",
  "Fundamental completo",
  "Médio incompleto",
  "Médio completo",
  "Superior incompleto",
  "Superior completo",
  "Pós-graduação",
  "Mestrado",
  "Doutorado",
];

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  {
    key: "name",
    label: "Nome completo",
    input: "text",
    group: "Dados pessoais",
    required: true,
    wide: true,
  },
  { key: "birth_date", label: "Data de nascimento", input: "date", group: "Dados pessoais" },
  {
    key: "marital_status",
    label: "Estado civil",
    input: "select",
    group: "Dados pessoais",
    options: MARITAL_STATUS_OPTIONS,
  },

  {
    key: "email",
    label: "E-mail",
    input: "email",
    group: "Contato",
    placeholder: "nome@wgbaterias.com.br",
  },
  {
    key: "phone",
    label: "Telefone / WhatsApp",
    input: "tel",
    group: "Contato",
    placeholder: "(00) 00000-0000",
  },

  { key: "address_zip", label: "CEP", input: "text", group: "Endereço", placeholder: "00000-000" },
  { key: "address_street", label: "Logradouro", input: "text", group: "Endereço", wide: true },
  { key: "address_number", label: "Número", input: "text", group: "Endereço" },
  { key: "address_complement", label: "Complemento", input: "text", group: "Endereço" },
  { key: "address_district", label: "Bairro", input: "text", group: "Endereço" },
  { key: "address_city", label: "Cidade", input: "text", group: "Endereço" },
  { key: "address_state", label: "UF", input: "text", group: "Endereço", placeholder: "PR" },

  {
    key: "education_level",
    label: "Escolaridade",
    input: "select",
    group: "Formação e dependentes",
    options: EDUCATION_OPTIONS,
  },
  {
    key: "dependents",
    label: "Dependentes",
    input: "textarea",
    group: "Formação e dependentes",
    wide: true,
    placeholder: "Nome e data de nascimento de cada dependente, um por linha.",
  },
];

export const PROFILE_FIELD_GROUPS = [
  "Dados pessoais",
  "Contato",
  "Endereço",
  "Formação e dependentes",
] as const;

const LABELS = new Map(PROFILE_FIELDS.map((f) => [f.key, f.label]));

export function fieldLabel(key: string): string {
  return LABELS.get(key as ProfileFieldKey) ?? key;
}

/** Uma alteração pedida: valor anterior → valor proposto. */
export type ProfileChange = { from: string | null; to: string | null };
export type ProfileChanges = Record<string, ProfileChange>;

export const REQUEST_STATUSES = ["pendente", "aprovada", "rejeitada", "cancelada"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pendente: "Em análise",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

/** Campos comparados só pelos dígitos (formatação não conta como alteração). */
const DIGIT_ONLY: ReadonlySet<string> = new Set(["phone", "address_zip"]);

/** Normaliza para comparação: string vazia vira null, espaços são colapsados. */
export function normalizeProfileValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  let s = String(value).trim().replace(/\s+/g, " ");
  if (DIGIT_ONLY.has(key)) s = s.replace(/\D/g, "");
  return s.length === 0 ? null : s;
}

/**
 * Compara o cadastro atual com os valores propostos e devolve só o que mudou.
 * Usado tanto na tela (para o passo de revisão) quanto no servidor — a regra de
 * "o que conta como alteração" precisa ser exatamente a mesma nos dois lados.
 */
export function diffProfile(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
): ProfileChanges {
  const changes: ProfileChanges = {};
  for (const key of PROFILE_FIELD_KEYS) {
    if (!(key in proposed)) continue;
    const from = normalizeProfileValue(key, current[key]);
    const to = normalizeProfileValue(key, proposed[key]);
    if (from === to) continue;
    // guarda o valor exibível, não o normalizado (não descaracteriza o telefone)
    const raw = proposed[key];
    changes[key] = {
      from:
        current[key] == null || String(current[key]).trim() === "" ? null : String(current[key]),
      to: raw == null || String(raw).trim() === "" ? null : String(raw).trim(),
    };
  }
  return changes;
}

/** Rótulos dos campos de uma solicitação, na ordem em que aparecem no formulário. */
export function changedFieldLabels(changes: ProfileChanges): string[] {
  return PROFILE_FIELDS.filter((f) => f.key in changes).map((f) => f.label);
}
