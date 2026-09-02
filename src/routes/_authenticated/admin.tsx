import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Menu, X, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EXTRA_KEYS, RESOURCES, SIDEBAR_EXTRA } from "@/lib/admin-resources";
import { pendingProfileRequestsQuery } from "@/lib/admin-queries";
import { WGLogo } from "@/components/wg-logo";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel — Portal WG" }] }),
  component: AdminLayout,
});

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  badge?: number;
};

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");
  const [open, setOpen] = useState(false);
  const pending = useQuery(pendingProfileRequestsQuery);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  // Group by section
  const sections = new Map<string, NavItem[]>();
  sections.set("Início", [{ key: "", label: "Dashboard", icon: LayoutDashboard, to: "/admin" }]);
  RESOURCES.forEach((r) => {
    const s = r.section ?? "Outros";
    const arr = sections.get(s) ?? [];
    arr.push({ key: r.key, label: r.label, icon: r.icon });
    sections.set(s, arr);
  });
  SIDEBAR_EXTRA.forEach((x) => {
    const arr = sections.get(x.section) ?? [];
    arr.push({
      key: x.key,
      label: x.label,
      icon: x.icon,
      to: x.to,
      badge: x.key === "solicitacoes" ? pending.data : undefined,
    });
    sections.set(x.section, arr);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-2">
          <WGLogo className="h-8 w-8" />
          <span className="font-bold text-sm">Painel WG</span>
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 hover:bg-secondary">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <div className="flex">
        <aside
          className={`${open ? "block" : "hidden"} lg:block fixed lg:static inset-0 top-[57px] lg:top-0 z-30 w-full lg:w-72 bg-sidebar border-r border-sidebar-border overflow-y-auto lg:min-h-screen`}
        >
          <div className="hidden lg:flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
            <WGLogo className="h-9 w-9" />
            <div>
              <div className="text-sm font-black">Painel WG</div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                Gente &amp; Gestão
              </div>
            </div>
          </div>
          <nav className="p-3 space-y-4">
            {Array.from(sections.entries()).map(([sec, items]) => (
              <div key={sec}>
                <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {sec}
                </div>
                <div className="space-y-0.5">
                  {items.map((it) => {
                    const isResource = it.key !== "" && !EXTRA_KEYS.has(it.key);
                    const active =
                      it.key === ""
                        ? pathname === "/admin"
                        : isResource
                          ? pathname.endsWith(`/recurso/${it.key}`)
                          : pathname.endsWith(`/${it.key}`);
                    const className = `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"}`;
                    if (isResource) {
                      return (
                        <Link
                          key={it.key}
                          to="/admin/recurso/$key"
                          params={{ key: it.key }}
                          className={className}
                        >
                          <it.icon className="h-4 w-4" />
                          <span>{it.label}</span>
                        </Link>
                      );
                    }
                    return (
                      <Link key={it.key || "root"} to={it.to ?? "/admin"} className={className}>
                        <it.icon className="h-4 w-4" />
                        <span>{it.label}</span>
                        {!!it.badge && (
                          <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-black text-sidebar-primary-foreground">
                            {it.badge > 99 ? "99+" : it.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-4 border-t border-sidebar-border mt-4">
            <div className="text-[11px] text-muted-foreground mb-2 truncate">{email}</div>
            <button
              onClick={signOut}
              className="w-full inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-bold hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
