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
    // Entrou com a senha provisória do G&G (acesso por CPF): cria a própria antes de seguir.
    if (data.user.app_metadata?.must_change_password) {
      throw redirect({ to: "/colaborador/nova-senha" });
    }
    return { user: data.user };
  },
  component: () => (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  ),
});
