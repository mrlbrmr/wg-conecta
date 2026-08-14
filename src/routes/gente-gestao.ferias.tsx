import { createFileRoute } from "@tanstack/react-router";
import { GGPageView } from "@/components/gg-page-view";
export const Route = createFileRoute("/gente-gestao/ferias")({
  head: () => ({ meta: [{ title: "Férias — Portal WG" }] }),
  component: () => <GGPageView pageKey="ferias" defaultTitle="Solicitação de Férias" />,
});
