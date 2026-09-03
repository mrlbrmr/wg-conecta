import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/comunicados/")({
  beforeLoad: () => {
    throw redirect({ to: "/mural" });
  },
});
