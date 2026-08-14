import { createFileRoute } from "@tanstack/react-router";
import { GGPageView } from "@/components/gg-page-view";
export const Route = createFileRoute("/_portal/gente-gestao/atestados")({
  head: () => ({ meta: [{ title: "Atestados — Portal WG" }] }),
  component: () => <GGPageView pageKey="atestados" defaultTitle="Atestados Médicos" />,
});
