import { z } from "zod";
import { DEPARTMENTS, UNITS } from "@/lib/org";

/**
 * Envios que não precisam (ou não devem) identificar quem escreveu.
 *
 * - **Canal de Escuta**: relatos de assédio, discriminação, conduta antiética, segurança. Anônimo
 *   por padrão; nome e contato só se a pessoa quiser.
 * - **SIM — Sistema Interno de Melhorias**: sugestões de melhoria de processo e estrutura. Nome e
 *   contato opcionais, "para receber qual foi a resolução".
 *
 * Os dois gravam em `anonymous_submissions`, que não tem coluna de autor. O acompanhamento é
 * por protocolo + chave, entregues só a quem enviou. Ver
 * `supabase/migrations/20260915140000_anonymous_submissions.sql`.
 *
 * Fica fora de `*.functions.ts` porque a tela e o servidor validam com o mesmo schema.
 */

export const CHANNELS = ["escuta", "sim"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_META: Record<
  Channel,
  { title: string; short: string; prefix: string; received: string; route: "/canal-de-escuta" | "/sim" }
> = {
  escuta: {
    title: "Canal de Escuta",
    short: "Canal de Escuta",
    prefix: "ESC",
    received: "Seu relato chegou ao time de Gente & Gestão.",
    route: "/canal-de-escuta",
  },
  sim: {
    title: "SIM — Sistema Interno de Melhorias",
    short: "SIM",
    prefix: "SIM",
    received: "Sua sugestão chegou ao time de Gente & Gestão.",
    route: "/sim",
  },
};

export const CHANNEL_OF_PREFIX: Record<string, Channel> = { ESC: "escuta", SIM: "sim" };

// ── Canal de Escuta ───────────────────────────────────────────────────

export const ESCUTA_CATEGORIES = [
  { value: "assedio_moral", label: "Assédio moral" },
  { value: "assedio_sexual", label: "Assédio sexual" },
  { value: "discriminacao", label: "Discriminação ou preconceito" },
  { value: "conduta", label: "Conduta antiética, fraude ou desvio" },
  { value: "seguranca", label: "Segurança do trabalho" },
  { value: "outro", label: "Outro assunto" },
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const escutaSchema = z.object({
  category: z.enum(ESCUTA_CATEGORIES.map((c) => c.value) as [string, ...string[]], {
    errorMap: () => ({ message: "Escolha o assunto." }),
  }),
  description: z
    .string()
    .trim()
    .min(20, "Conte um pouco mais — pelo menos algumas linhas.")
    .max(5000, "O relato passou de 5.000 caracteres."),
  where: optionalText(200),
  when: optionalText(120),
  involved: optionalText(500),
  contact_name: optionalText(120),
  contact: optionalText(200),
});

// ── SIM ───────────────────────────────────────────────────────────────

export const SIM_KINDS = ["Interna", "Externa"] as const;
export const SIM_SECTORS = [...DEPARTMENTS, "Outro"] as const;
export const SIM_REASONS = [
  "Melhoria de processo",
  "Melhoria de estrutura",
  "Elogio, crítica ou sugestão",
  "Outro",
] as const;

export const simSchema = z.object({
  unit: z.enum(UNITS, { errorMap: () => ({ message: "Escolha o local de trabalho." }) }),
  kind: z.enum(SIM_KINDS, { errorMap: () => ({ message: "Escolha o tipo de melhoria." }) }),
  sector: z.enum(SIM_SECTORS, { errorMap: () => ({ message: "Escolha o setor." }) }),
  reason: z.enum(SIM_REASONS, { errorMap: () => ({ message: "Escolha o motivo." }) }),
  description: z
    .string()
    .trim()
    .min(10, "Descreva a situação e, se tiver, uma possível solução.")
    .max(3000, "A descrição passou de 3.000 caracteres."),
  contact_name: optionalText(120),
  contact: optionalText(200),
});

export function schemaForChannel(channel: Channel) {
  return channel === "escuta" ? escutaSchema : simSchema;
}

/** O que vai para a coluna `category`: o assunto no Canal de Escuta, o motivo no SIM. */
export function categoryOf(channel: Channel, payload: Record<string, unknown>): string {
  return String(channel === "escuta" ? payload.category : payload.reason);
}

// ── Leitura ───────────────────────────────────────────────────────────

const LABELS: Record<Channel, [key: string, label: string][]> = {
  escuta: [
    ["category", "Assunto"],
    ["description", "Relato"],
    ["where", "Onde aconteceu"],
    ["when", "Quando"],
    ["involved", "Pessoas envolvidas"],
    ["contact_name", "Nome (opcional)"],
    ["contact", "Contato (opcional)"],
  ],
  sim: [
    ["unit", "Local de trabalho"],
    ["kind", "Tipo de melhoria"],
    ["sector", "Para qual setor"],
    ["reason", "Motivo"],
    ["description", "Situação e possível solução"],
    ["contact_name", "Nome (opcional)"],
    ["contact", "Contato (opcional)"],
  ],
};

export function categoryLabel(channel: Channel, value: string): string {
  if (channel === "escuta") return ESCUTA_CATEGORIES.find((c) => c.value === value)?.label ?? value;
  return value;
}

/** Campos preenchidos, na ordem do formulário e com rótulo. */
export function renderSubmission(channel: Channel, payload: Record<string, unknown>) {
  return LABELS[channel]
    .map(([key, label]) => {
      const raw = payload[key];
      const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
      return {
        key,
        label,
        value: key === "category" ? categoryLabel(channel, value) : value,
      };
    })
    .filter((e) => e.value);
}

export const SUBMISSION_STATUSES = ["recebido", "em_analise", "concluido"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  concluido: "Concluído",
};

/** Protocolo como a pessoa digita: "esc 7k2m9q" → "ESC-7K2M9Q". */
export function normalizeProtocol(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

/** Chave como a pessoa digita: "k4pq 7xr2" → "K4PQ-7XR2". */
export function normalizeAccessKey(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
