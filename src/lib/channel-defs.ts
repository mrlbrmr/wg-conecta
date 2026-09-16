import { z } from "zod";
import { UNITS } from "@/lib/org";

/**
 * Canais de escuta do portal — hoje o SIM (Sistema Interno de Melhorias); o Canal de Escuta
 * entra no PR seguinte, na mesma base.
 *
 * Gravam em `channel_submissions` (ver `supabase/migrations/20260915170000_channel_submissions.sql`).
 * No SIM a pessoa escolhe:
 * - **com o nome**: o autor vem do login, no servidor, e o envio aparece no Perfil;
 * - **sem se identificar**: nenhuma coluna liga o envio a ela, e o acompanhamento é por
 *   protocolo + chave, entregues só a quem enviou.
 *
 * Fica fora de `*.functions.ts` porque a tela e o servidor validam com o mesmo schema.
 */

export const CHANNELS = ["sim"] as const;
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
};

export const CHANNEL_OF_PREFIX: Record<string, Channel> = { SIM: "sim" };

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
};

/** Campos preenchidos, na ordem do formulário e com rótulo. */
export function renderSubmission(channel: Channel, payload: Record<string, unknown>) {
  return LABELS[channel]
    .map(([key, label]) => {
      const raw = payload[key];
      const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
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
