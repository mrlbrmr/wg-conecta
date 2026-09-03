import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/mural")({
  component: () => <Outlet />,
});
