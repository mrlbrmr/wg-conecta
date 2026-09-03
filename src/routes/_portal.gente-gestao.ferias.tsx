import { createFileRoute, Link } from "@tanstack/react-router";
import { GGPageView } from "@/components/gg-page-view";
import { InkButton } from "@/components/paper";

export const Route = createFileRoute("/_portal/gente-gestao/ferias")({
  head: () => ({ meta: [{ title: "Férias — Portal WG" }] }),
  component: () => (
    <GGPageView
      pageKey="ferias"
      defaultTitle="Solicitação de Férias"
      action={
        <InkButton variant="accent" asChild>
          <Link to="/formularios/$slug" params={{ slug: "ferias" }}>
            Solicitar férias ↗
          </Link>
        </InkButton>
      }
    />
  ),
});
