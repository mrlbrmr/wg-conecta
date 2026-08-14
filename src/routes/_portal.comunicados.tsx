import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { PortalLayout } from "@/components/portal-layout";
export const Route = createFileRoute("/_portal/comunicados")({
  component: () => <PortalLayout><Outlet /></PortalLayout>,
});
export const _l = Link;
