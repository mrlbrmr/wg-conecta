import { createFileRoute } from "@tanstack/react-router";
import { GGPageView } from "@/components/gg-page-view";
export const Route = createFileRoute("/_portal/gente-gestao/politicas")({
  head: () => ({ meta: [{ title: "Políticas Internas — Portal WG" }] }),
  component: () => <GGPageView pageKey="politicas" defaultTitle="Políticas Internas" />,
});
