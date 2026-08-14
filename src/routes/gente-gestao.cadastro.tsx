import { createFileRoute } from "@tanstack/react-router";
import { GGPageView } from "@/components/gg-page-view";
export const Route = createFileRoute("/gente-gestao/cadastro")({
  head: () => ({ meta: [{ title: "Atualização Cadastral — Portal WG" }] }),
  component: () => <GGPageView pageKey="cadastro" defaultTitle="Atualização Cadastral" />,
});
