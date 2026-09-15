/** Etapas da trilha de integração, em ordem cronológica — do 1º dia aos 90. */
export const ONBOARDING_STAGES = [
  { id: "primeiro_dia", label: "1º dia" },
  { id: "primeira_semana", label: "1ª semana" },
  { id: "trinta_dias", label: "30 dias" },
  { id: "sessenta_dias", label: "60 dias" },
  { id: "noventa_dias", label: "90 dias" },
] as const;

export type OnboardingStageId = (typeof ONBOARDING_STAGES)[number]["id"];

const STAGE_RANK = new Map<string, number>(ONBOARDING_STAGES.map((s, i) => [s.id, i]));

/**
 * Ordem cronológica dos itens: primeiro a etapa, depois o `order_index` dentro dela.
 * O "Ordem" do admin sozinho deixava um item de 90 dias passar à frente de um do 1º dia.
 * Etapa desconhecida vai para o fim.
 */
export function compareChecklistItems(
  a: { stage?: unknown; order_index?: unknown },
  b: { stage?: unknown; order_index?: unknown },
): number {
  const rank = (s: unknown) => STAGE_RANK.get(String(s)) ?? ONBOARDING_STAGES.length;
  const order = (o: unknown) => (typeof o === "number" ? o : Number.MAX_SAFE_INTEGER);
  return rank(a.stage) - rank(b.stage) || order(a.order_index) - order(b.order_index);
}
