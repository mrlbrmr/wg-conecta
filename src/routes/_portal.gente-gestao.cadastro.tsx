import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * A Atualização Cadastral virou um dos formulários do catálogo.
 *
 * O fluxo é o mesmo de antes — diff contra o cadastro e aprovação no painel,
 * em `profile_update_requests`. Só a tela mudou de lugar. Este redirect existe
 * para os links já salvos por aí não morrerem.
 */
export const Route = createFileRoute("/_portal/gente-gestao/cadastro")({
  beforeLoad: () => {
    throw redirect({
      to: "/formularios/$slug",
      params: { slug: "atualizacao-cadastral" },
      replace: true,
    });
  },
});
