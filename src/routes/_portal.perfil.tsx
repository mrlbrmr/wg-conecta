import { createFileRoute } from "@tanstack/react-router";
import { PageHeading } from "@/components/paper";

export const Route = createFileRoute("/_portal/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Portal WG" }] }),
  component: () => (
    <PageHeading
      kicker="Meu perfil"
      title="Seus dados, do seu jeito."
      subtitle="Em construção — esta página chega na próxima etapa da entrega."
    />
  ),
});
