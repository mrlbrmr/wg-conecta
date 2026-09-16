import { z } from "zod";
import { UNITS } from "@/lib/org";

/**
 * Canais do portal: o SIM (Sistema Interno de Melhorias) e o Canal de Escuta, na mesma base.
 *
 * Gravam em `channel_submissions` (ver `supabase/migrations/20260915170000_channel_submissions.sql`).
 * No SIM a pessoa escolhe:
 * - **com o nome**: o autor vem do login, no servidor, e o envio aparece no Perfil;
 * - **sem se identificar**: nenhuma coluna liga o envio a ela, e o acompanhamento é por
 *   protocolo + chave, entregues só a quem enviou.
 *
 * No Canal de Escuta o envio **nunca** tem autor (a constraint
 * `channel_submissions_escuta_sem_autor` garante). Nome e contato só existem se a pessoa digitar
 * no próprio relato, e o acompanhamento é sempre por protocolo + chave.
 *
 * Fica fora de `*.functions.ts` porque a tela e o servidor validam com o mesmo schema.
 */

export const CHANNELS = ["sim", "escuta"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_META: Record<
  Channel,
  { title: string; short: string; prefix: string; received: string }
> = {
  sim: {
    title: "SIM — Sistema Interno de Melhorias",
    short: "SIM",
    prefix: "SIM",
    received: "Seu SIM chegou ao time de Gente & Gestão.",
  },
  escuta: {
    title: "Canal de Escuta",
    short: "Canal de Escuta",
    prefix: "ESC",
    received: "Seu relato chegou ao time de Gente & Gestão.",
  },
};

export const CHANNEL_OF_PREFIX: Record<string, Channel> = { SIM: "sim", ESC: "escuta" };

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

// ── SIM ───────────────────────────────────────────────────────────────

export const SIM_KINDS = ["Interna", "Externa"] as const;
export const SIM_REASONS = [
  "Melhoria de processo",
  "Melhoria de estrutura",
  "Elogio, crítica ou sugestão",
  "Outro",
] as const;

/**
 * O que a tela manda. O nome não está aqui de propósito: no envio identificado ele vem do
 * cadastro, no servidor; no anônimo, o servidor descarta também o contato.
 */
export const simSchema = z.object({
  unit: z.enum(UNITS, { errorMap: () => ({ message: "Escolha o local de trabalho." }) }),
  kind: z.enum(SIM_KINDS, { errorMap: () => ({ message: "Escolha o tipo de melhoria." }) }),
  reason: z.enum(SIM_REASONS, { errorMap: () => ({ message: "Escolha o motivo." }) }),
  description: z
    .string()
    .trim()
    .min(10, "Descreva a situação e, se tiver, uma possível solução.")
    .max(3000, "A descrição passou de 3.000 caracteres."),
  contact: optionalText(200),
});

// ── Canal de Escuta ───────────────────────────────────────────────────

export const ESCUTA_CATEGORIES = [
  { value: "assedio_moral", label: "Assédio moral" },
  { value: "assedio_sexual", label: "Assédio sexual" },
  { value: "discriminacao", label: "Discriminação ou preconceito" },
  { value: "conduta", label: "Conduta antiética, fraude ou desvio" },
  { value: "seguranca", label: "Segurança do trabalho" },
  { value: "outro", label: "Outro assunto" },
] as const;

const ESCUTA_VALUES = ESCUTA_CATEGORIES.map((c) => c.value) as [
  (typeof ESCUTA_CATEGORIES)[number]["value"],
  ...(typeof ESCUTA_CATEGORIES)[number]["value"][],
];

export const ESCUTA_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  ESCUTA_CATEGORIES.map((c) => [c.value, c.label]),
);

/** Nome e contato são opcionais e ficam só no texto do relato — nunca viram autor. */
export const escutaSchema = z.object({
  category: z.enum(ESCUTA_VALUES, { errorMap: () => ({ message: "Escolha o assunto." }) }),
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

// ── Leitura ───────────────────────────────────────────────────────────

const LABELS: Record<Channel, [key: string, label: string][]> = {
  sim: [
    ["contact_name", "Nome"],
    ["contact", "Contato"],
    ["unit", "Local de trabalho"],
    ["kind", "Tipo de melhoria"],
    // Só nos envios antigos: o SIM deixou de perguntar o setor (vai sempre ao G&G).
    ["sector", "Setor"],
    ["reason", "Motivo"],
    ["description", "Situação e possível solução"],
  ],
  escuta: [
    ["contact_name", "Nome"],
    ["contact", "Contato"],
    ["category", "Assunto"],
    ["description", "Relato"],
    ["where", "Onde"],
    ["when", "Quando"],
    ["involved", "Pessoas envolvidas"],
  ],
};

/** Campos preenchidos, na ordem do formulário e com rótulo. */
export function renderSubmission(channel: Channel, payload: Record<string, unknown>) {
  return LABELS[channel]
    .map(([key, label]) => {
      const raw = payload[key];
      let value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
      // O assunto do Canal de Escuta é gravado como código ("assedio_moral").
      if (channel === "escuta" && key === "category") value = ESCUTA_CATEGORY_LABEL[value] ?? value;
      return { key, label, value };
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

export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus, "accent" | "soft" | "success"> = {
  recebido: "accent",
  em_analise: "soft",
  concluido: "success",
};

/** Protocolo como a pessoa digita: "sim 7k2m9q" → "SIM-7K2M9Q". */
export function normalizeProtocol(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

/** Chave como a pessoa digita: "k4pq 7xr2" → "K4PQ-7XR2". */
export function normalizeAccessKey(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
