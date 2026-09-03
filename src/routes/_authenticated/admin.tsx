import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Menu, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EXTRA_KEYS, RESOURCES, SIDEBAR_EXTRA, findResource } from "@/lib/admin-resources";
import { openRequestsQuery, pendingProfileRequestsQuery } from "@/lib/admin-queries";
import { WGLogo } from "@/components/wg-logo";
import { AdminSearchContext } from "@/components/admin-search";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "wg-admin-sidebar-collapsed";

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
  const [email, setEmail] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [term, setTerm] = useState("");
  const pendingProfile = useQuery(pendingProfileRequestsQuery);
  const openRequests = useQuery(openRequestsQuery);
  // O badge conta as duas filas de /admin/solicitacoes.
  const pendingTotal = (pendingProfile.data ?? 0) + (openRequests.data ?? 0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // navegador sem storage: fica expandida
    }
  }, []);

  // Trocar de seção fecha o menu mobile e limpa a busca.
  useEffect(() => {
    setMobileOpen(false);
    setTerm("");
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // sem storage: o estado vale só para esta sessão
      }
      return next;
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const sections = new Map<string, NavItem[]>();
  sections.set("Início", [{ key: "", label: "Dashboard", icon: LayoutDashboard, to: "/admin" }]);
  for (const r of RESOURCES) {
    const s = r.section ?? "Outros";
    sections.set(s, [...(sections.get(s) ?? []), { key: r.key, label: r.label, icon: r.icon }]);
  }
  for (const x of SIDEBAR_EXTRA) {
    sections.set(x.section, [
      ...(sections.get(x.section) ?? []),
      {
        key: x.key,
        label: x.label,
        icon: x.icon,
        to: x.to,
        badge: x.key === "solicitacoes" ? pendingTotal : undefined,
      },
    ]);
  }

  const breadcrumb = breadcrumbFor(pathname);

  return (
    <AdminSearchContext.Provider value={{ term, setTerm }}>
      <div className="flex min-h-screen bg-background">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex flex-col overflow-y-auto bg-ink text-paper transition-[width] duration-200 ease-standard lg:sticky lg:top-0 lg:h-screen",
            collapsed ? "w-[76px]" : "w-[272px]",
            mobileOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
            <WGLogo className="h-9 w-9 shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent">
                  Painel WG
                </div>
                <div className="truncate text-[15px] font-black leading-tight">
                  Gente &amp; Gestão
                </div>
              </div>
            )}
          </div>

          <nav className="flex flex-col gap-[18px] px-2.5 py-3">
            {Array.from(sections.entries()).map(([section, items]) => (
              <div key={section}>
                {!collapsed && (
                  <div className="px-3 pb-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-paper/50">
                    {section}
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const isResource = item.key !== "" && !EXTRA_KEYS.has(item.key);
                    const active =
                      item.key === ""
                        ? pathname === "/admin"
                        : isResource
                          ? pathname.endsWith(`/recurso/${item.key}`)
                          : pathname.endsWith(`/${item.key}`);

                    const className = cn(
                      "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors",
                      active
                        ? "bg-sidebar-accent text-paper"
                        : "text-paper/[0.82] hover:bg-sidebar-accent/60",
                      collapsed && "justify-center px-0",
                    );

                    const inner = (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            "absolute bottom-2 left-0 top-2 w-[3px] rounded-full",
                            active ? "bg-accent" : "bg-transparent",
                          )}
                        />
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-accent" : "text-paper/70",
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {item.badge ? (
                          <span
                            className={cn(
                              "ml-auto grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-black tabular-nums text-ink",
                              collapsed && "absolute right-1.5 top-1.5 ml-0",
                            )}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </>
                    );

                    return isResource ? (
                      <Link
                        key={item.key}
                        to="/admin/recurso/$key"
                        params={{ key: item.key }}
                        title={collapsed ? item.label : undefined}
                        className={className}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <Link
                        key={item.key || "dashboard"}
                        to={item.to ?? "/admin"}
                        title={collapsed ? item.label : undefined}
                        className={className}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-sidebar-border p-4">
            {!collapsed && <div className="mb-2 truncate text-[11px] text-paper/60">{email}</div>}
            <button
              onClick={signOut}
              title="Sair"
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-full border border-sidebar-border px-3 py-2 text-sm font-bold transition hover:bg-sidebar-accent",
                collapsed && "px-0",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && "Sair"}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b-[1.5px] border-ink bg-paper/95 px-4 py-3.5 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    window.innerWidth < 1024 ? setMobileOpen((v) => !v) : toggleCollapsed()
                  }
                  aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border-[1.5px] border-ink bg-surface transition hover:bg-accent"
                >
                  {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
                <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                  {breadcrumb}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden w-[320px] items-center border-[1.5px] border-ink bg-surface md:flex">
                  <Search className="ml-3 h-[15px] w-[15px] shrink-0 text-muted-foreground" />
                  <label className="sr-only" htmlFor="busca-admin">
                    Buscar na seção
                  </label>
                  <input
                    id="busca-admin"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Buscar nesta seção"
                    className="w-full bg-transparent px-2.5 py-2 text-[13.5px] outline-none"
                  />
                </div>
                <Link
                  to="/"
                  className="hidden shrink-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink hover:text-primary sm:block"
                >
                  Ver portal ↗
                </Link>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-ink text-[12px] font-black text-accent">
                  {(email.slice(0, 2) || "WG").toUpperCase()}
                </span>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminSearchContext.Provider>
  );
}

/** "Painel WG · grupo · seção" a partir da rota aberta. */
function breadcrumbFor(pathname: string): string {
  if (pathname === "/admin") return "Painel WG · Início · Dashboard";

  const resourceKey = pathname.match(/\/recurso\/([^/]+)/)?.[1];
  if (resourceKey) {
    const r = findResource(resourceKey);
    if (r) return `Painel WG · ${r.section ?? "Outros"} · ${r.label}`;
  }

  const extra = SIDEBAR_EXTRA.find((x) => pathname.endsWith(`/${x.key}`));
  if (extra) return `Painel WG · ${extra.section} · ${extra.label}`;

  return "Painel WG";
}
