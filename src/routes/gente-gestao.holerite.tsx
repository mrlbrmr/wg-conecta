import { createFileRoute } from "@tanstack/react-router";
import { GGPageView } from "@/components/gg-page-view";
export const Route = createFileRoute("/gente-gestao/holerite")({
  head: () => ({ meta: [{ title: "Holerite — Portal WG" }] }),
  component: () => <GGPageView pageKey="holerite" defaultTitle="Holerite" />,
});
