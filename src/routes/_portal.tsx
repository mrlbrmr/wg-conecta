import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/portal-layout";

export const Route = createFileRoute("/_portal")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/gate" });
    }
    return { user: data.user };
  },
  component: () => (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  ),
});
