import { createFileRoute, Outlet } from "@tanstack/react-router";

/** O mural passou a viver em /mural. Esta árvore só redireciona. */
export const Route = createFileRoute("/_portal/comunicados")({
  component: () => <Outlet />,
});
