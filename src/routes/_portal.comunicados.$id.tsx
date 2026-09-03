import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/comunicados/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/mural/$id", params: { id: params.id } });
  },
});
