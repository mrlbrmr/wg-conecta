import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Catálogo em `/formularios` e os formulários internos em `/formularios/<slug>`. */
export const Route = createFileRoute("/_portal/formularios")({
  component: () => <Outlet />,
});
