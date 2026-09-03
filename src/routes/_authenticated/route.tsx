import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/admin.functions";

// Gate do painel: client-only, para evitar problemas de sessão no SSR.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Estar logado não basta: o painel é só para quem está em `admin_users`.
    // Sem isto, um colaborador comum chegava até aqui e via as telas vazias
    // por causa do RLS, em vez de ser barrado.
    const { isAdmin } = await amIAdmin();
    if (!isAdmin) {
      throw redirect({ to: "/" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
