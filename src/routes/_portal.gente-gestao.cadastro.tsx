import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * "Atualização Cadastral" virou "Meu perfil" (`/perfil`), com foto, bio, ficha,
 * time, trilha e solicitações. A rota antiga fica só como redirecionamento —
 * o link já circulou por e-mail.
 */
export const Route = createFileRoute("/_portal/gente-gestao/cadastro")({
  beforeLoad: () => {
    throw redirect({ to: "/perfil" });
  },
});
