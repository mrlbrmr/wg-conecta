/**
 * Os formulários internos de Gente & Gestão.
 *
 * Fonte única compartilhada por quatro consumidores — a tela do formulário, a
 * server function que grava, a fila do painel e o e-mail de notificação. O
 * schema zod é a regra: a tela usa `safeParse` para mostrar erro por campo e o
 * servidor revalida com o mesmo schema, então uma falha na tela não vira dado
 * torto no banco.
 *
 * Mesmo papel que `profile-fields.ts` cumpre para a atualização cadastral —
 * que continua com fluxo próprio (diff + aprovação que aplica no cadastro) e
 * aqui só aparece como metadado de catálogo.
 */

import { z } from "zod";

export const FORM_SLUGS = ["ferias", "atualizacao-cadastral", "solicitacao-geral"] as const;
export type FormSlug = (typeof FORM_SLUGS)[number];

/** Slugs que gravam em `requests`. A cadastral tem tabela própria. */
export const REQUEST_FORM_SLUGS = ["ferias", "solicitacao-geral"] as const;
export type RequestFormSlug = (typeof REQUEST_FORM_SLUGS)[number];

export function isFormSlug(v: string): v is FormSlug {
  return (FORM_SLUGS as readonly string[]).includes(v);
}

export function isRequestFormSlug(v: string): v is RequestFormSlug {
  return (REQUEST_FORM_SLUGS as readonly string[]).includes(v);
}

/** Aviso recorrente do produto. Estava copiado em três telas; agora mora aqui. */
export const PRIVACY_NOTE =
  "Uso interno. Não compartilhe CPF, documentos ou dados bancários por aqui — dados cadastrais só pelo canal de Atualização Cadastral.";

/** Os três passos do cartão "Como funciona", na lateral do formulário. */
export const HOW_IT_WORKS = [
  "Você envia o formulário.",
  "Gente & Gestão confere com seu gestor.",
  "A resposta chega no seu e-mail e aqui no portal.",
] as const;

export interface FormMeta {
  slug: FormSlug;
  /** Título da tela. O do catálogo vem de `forms.title`, no banco. */
  title: string;
  subtitle: string;
  category: string;
  /** Chave do ICON_MAP. */
  icon: string;
  /** Nota do rodapé, à esquerda dos botões. */
  footerNote: string;
}

export const FORM_META: Record<FormSlug, FormMeta> = {
  ferias: {
    slug: "ferias",
    title: "Formulário de Férias",
    subtitle: "Solicite suas férias",
    category: "Férias",
    icon: "ClipboardList",
    footerNote: "O período fica sujeito à confirmação do seu gestor e à escala do setor.",
  },
  "atualizacao-cadastral": {
    slug: "atualizacao-cadastral",
    title: "Atualização Cadastral",
    subtitle: "Atualize seus dados",
    category: "Atualização Cadastral",
    icon: "UserCog",
    footerNote: "A gente atualiza na folha e te confirma por e-mail quando estiver feito.",
  },
  "solicitacao-geral": {
    slug: "solicitacao-geral",
    title: "Solicitação Geral G&G",
    subtitle: "Envie sua solicitação",
    category: "Gente & Gestão",
    icon: "ClipboardCheck",
    footerNote: "Se for algo urgente, marque a urgência acima que a gente prioriza.",
  },
};

// ── Identificação (comum aos três) ────────────────────────────────────

/**
 * Snapshot de quem enviou. Nome, setor e gestor vêm do cadastro e são
 * somente-leitura na tela; guardamos junto da solicitação porque o cadastro
 * muda e o G&G precisa ver o que valia no dia do envio.
 */
export const identificationSchema = z.object({
  name: z.string().trim().min(2, "Sem o nome a gente não sabe de quem é."),
  registration_number: z.string().trim().max(20).optional().default(""),
  department: z.string().trim().max(80).optional().default(""),
  manager_name: z.string().trim().max(120).optional().default(""),
});

export type Identification = z.infer<typeof identificationSchema>;

// ── Férias ────────────────────────────────────────────────────────────

export const YES_NO = ["Sim", "Não"] as const;

/**
 * Antecedência mínima do pedido — art. 135 da CLT, que manda comunicar as
 * férias com 30 dias. Se o G&G trabalhar com outro número, é aqui que muda.
 */
export const MIN_NOTICE_DAYS = 30;
/** Teto legal de um período de férias. */
export const MAX_VACATION_DAYS = 30;
/**
 * Vendendo 10 dias (abono pecuniário, 1/3 do período), sobram no máximo 20
 * dias de gozo — pedir mais que isso com abono não fecha a conta.
 */
export const MAX_DAYS_WITH_SELL = 20;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data.");

/**
 * Enum com recado em português.
 *
 * O erro padrão do zod para enum lista os valores aceitos em inglês
 * ("Invalid enum value. Expected …") — texto de biblioteca, não de produto.
 */
function enumWithMessage<T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z.enum(values, { errorMap: () => ({ message }) });
}

/** Dias entre duas datas ISO — é o número que o contador da tela mostra. */
export function vacationDays(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00`);
  const b = Date.parse(`${end}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Hoje em ISO, sem hora — para comparar com as datas do formulário. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const vacationSchema = identificationSchema
  .extend({
    start_date: isoDate,
    end_date: isoDate,
    advance_13th: enumWithMessage(YES_NO, "Responda sim ou não sobre o 13º."),
    sell_days: enumWithMessage(YES_NO, "Responda sim ou não sobre o abono."),
    coverage: z.string().trim().min(2, "Conta pra gente quem assume suas demandas."),
  })
  .superRefine((v, ctx) => {
    const days = vacationDays(v.start_date, v.end_date);

    if (days <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "O retorno precisa ser depois do início.",
      });
      return;
    }

    if (days > MAX_VACATION_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: `Um período de férias vai até ${MAX_VACATION_DAYS} dias. Esse tem ${days}.`,
      });
    }

    if (v.sell_days === "Sim" && days > MAX_DAYS_WITH_SELL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sell_days"],
        message: `Vendendo 10 dias, o descanso fica em até ${MAX_DAYS_WITH_SELL} dias. Ajuste as datas ou não venda o abono.`,
      });
    }

    if (vacationDays(todayIso(), v.start_date) < MIN_NOTICE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start_date"],
        message: `As férias são combinadas com ${MIN_NOTICE_DAYS} dias de antecedência. Se for exceção, abra uma solicitação geral que a gente vê o caso.`,
      });
    }
  });

export type VacationPayload = z.infer<typeof vacationSchema>;

// ── Solicitação Geral ─────────────────────────────────────────────────

export const GENERAL_SUBJECTS = [
  "Declaração ou comprovante",
  "Benefícios",
  "Ponto e escala",
  "Crachá e uniforme",
  "Treinamento",
  "Outro assunto",
] as const;

export const PRIORITIES = ["normal", "prioritaria", "urgente"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  normal: "Normal",
  prioritaria: "Prioritária",
  urgente: "Urgente",
};

/** Descrição curta demais volta pra fila sem contexto e atrasa a resposta. */
const MIN_DESCRIPTION = 20;

export const generalSchema = identificationSchema.extend({
  subject: enumWithMessage(GENERAL_SUBJECTS, "Escolha o assunto pra gente encaminhar direito."),
  priority: enumWithMessage(PRIORITIES, "Diga qual a urgência."),
  description: z
    .string()
    .trim()
    .min(MIN_DESCRIPTION, "Conta um pouco mais — com contexto a gente resolve de primeira.")
    .max(4000, "Ficou longo demais. Resuma e mande o resto em anexo."),
});

export type GeneralPayload = z.infer<typeof generalSchema>;

// ── Registro por slug ─────────────────────────────────────────────────

export const REQUEST_FORM_SCHEMAS = {
  ferias: vacationSchema,
  "solicitacao-geral": generalSchema,
} as const;

export function schemaFor(slug: RequestFormSlug) {
  return REQUEST_FORM_SCHEMAS[slug];
}

/** Prioridade da solicitação — só a geral tem urgência escolhida pela pessoa. */
export function priorityOf(slug: RequestFormSlug, payload: Record<string, unknown>): Priority {
  const raw = String(payload.priority ?? "");
  return (PRIORITIES as readonly string[]).includes(raw) ? (raw as Priority) : "normal";
}

/** Título da solicitação na fila e em "Meus envios". */
export function titleFor(slug: RequestFormSlug, payload: Record<string, unknown>): string {
  if (slug === "ferias") {
    const start = String(payload.start_date ?? "");
    const end = String(payload.end_date ?? "");
    const days = vacationDays(start, end);
    return `Férias de ${formatDateBr(start)} a ${formatDateBr(end)} (${days} ${days === 1 ? "dia" : "dias"})`;
  }
  return String(payload.subject ?? FORM_META["solicitacao-geral"].title);
}

// ── Leitura: o painel e o e-mail não conhecem o formato de cada formulário ──

export interface PayloadEntry {
  label: string;
  value: string;
}

const IDENTIFICATION_LABELS: Array<[string, string]> = [
  ["name", "Nome completo"],
  ["registration_number", "Matrícula"],
  ["department", "Setor"],
  ["manager_name", "Gestor imediato"],
];

const VACATION_LABELS: Array<[string, string]> = [
  ["start_date", "Início"],
  ["end_date", "Retorno"],
  ["advance_13th", "Adiantar 13º salário"],
  ["sell_days", "Vender 10 dias (abono)"],
  ["coverage", "Quem cobre no período"],
];

const GENERAL_LABELS: Array<[string, string]> = [
  ["subject", "Assunto"],
  ["priority", "Urgência"],
  ["description", "Descrição"],
];

export function formatDateBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function displayValue(key: string, raw: unknown): string {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "—";
  const value = String(raw);
  if (key === "start_date" || key === "end_date") return formatDateBr(value);
  if (key === "priority") return PRIORITY_LABEL[value as Priority] ?? value;
  return value;
}

/**
 * Pares rótulo/valor na ordem do formulário. É o que a fila do painel e o
 * e-mail renderizam — nenhum dos dois precisa conhecer o formato de cada slug.
 */
export function renderPayload(slug: string, payload: unknown): PayloadEntry[] {
  const data = (payload ?? {}) as Record<string, unknown>;
  const labels: Array<[string, string]> = [
    ...IDENTIFICATION_LABELS,
    ...(slug === "ferias" ? VACATION_LABELS : slug === "solicitacao-geral" ? GENERAL_LABELS : []),
  ];

  const known = new Set(labels.map(([key]) => key));
  const entries = labels
    .filter(([key]) => key in data)
    .map(([key, label]) => ({ label, value: displayValue(key, data[key]) }));

  // Campo que o schema não conhece não some da tela: o G&G precisa ver tudo que
  // chegou, inclusive de uma versão anterior do formulário.
  for (const [key, raw] of Object.entries(data)) {
    if (known.has(key)) continue;
    entries.push({ label: key, value: displayValue(key, raw) });
  }

  return entries;
}

// ── Erros de validação na tela ────────────────────────────────────────

/** Erros do zod achatados por campo, do jeito que o formulário consome. */
export type FieldErrors = Record<string, string>;

/** Primeira mensagem de cada campo — a tela mostra uma por vez. */
export function errorsOf(issues: z.ZodIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "");
    if (key && !out[key]) out[key] = i.message;
  }
  return out;
}
