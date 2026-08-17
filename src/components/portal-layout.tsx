import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Home, LayoutGrid, Megaphone, Briefcase, Search, PartyPopper, ArrowUpRight } from "lucide-react";
import { WGLogo } from "./wg-logo";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/gente-gestao", label: "G&G", icon: LayoutGrid },
  { to: "/comunicados", label: "Mural", icon: Megaphone },
  { to: "/vagas", label: "Vagas", icon: Briefcase },
  { to: "/cultura", label: "Cultura", icon: PartyPopper },
];

const DESKTOP_NAV = [
  { to: "/", label: "Início" },
  { to: "/gente-gestao", label: "Gente & Gestão" },
  { to: "/comunicados", label: "Mural" },
  { to: "/vagas", label: "Vagas internas" },
  { to: "/integracao", label: "Integração" },
  { to: "/formularios", label: "Formulários" },
  { to: "/cultura", label: "Cultura WG" },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Faixa editorial preta */}
      <div className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5 md:px-6 text-[10.5px] font-semibold tracking-[0.14em] uppercase">
          <span className="opacity-70 truncate">{today}</span>
          <span className="hidden sm:inline opacity-70">Comunicação Interna · Grupo WG</span>
          <span className="opacity-70">Edição diária</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <WGLogo className="h-11 w-11" variant="black" />
            <div className="hidden sm:block">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Portal do Colaborador</div>
              <div className="text-lg font-black leading-none tracking-tight">Aqui é WG.</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {DESKTOP_NAV.map((n) => {
              const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative inline-flex items-center whitespace-nowrap rounded-none px-2.5 py-2 text-[12px] font-bold uppercase tracking-wide leading-none transition ${
                    active
                      ? "text-ink after:absolute after:left-2.5 after:right-2.5 after:-bottom-[13px] after:h-[3px] after:bg-primary"
                      : "text-muted-foreground hover:text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link
            to="/busca"
            aria-label="Buscar no portal"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-ink bg-surface text-ink transition hover:bg-accent"
          >
            <Search className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main key={pathname} className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10 animate-slide-up">{children}</main>

      <PortalFooter />
      <MobileNav pathname={pathname} />
    </div>
  );
}

function PortalFooter() {
  return (
    <footer className="mt-16 border-t-[1.5px] border-ink bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <WGLogo className="h-9 w-9" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Portal do Colaborador</div>
                <div className="text-lg font-black leading-tight">Grupo WG · WG Baterias</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-paper/75">
              Este é o nosso canto — comunicados, benefícios, documentos e tudo que o dia a dia pede,
              feito por gente de dentro, pra gente de dentro.
            </p>
          </div>
          <div className="text-sm leading-relaxed">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Fale com a gente</div>
            <a href="mailto:gestaodepessoas@wgbaterias.com.br" className="mt-2 inline-flex items-center gap-1 font-bold text-paper hover:text-accent">
              gestaodepessoas@wgbaterias.com.br <ArrowUpRight className="h-4 w-4" />
            </a>
            <p className="mt-3 text-xs text-paper/60 max-w-xs">
              Uso interno. Nada de CPF, telefone pessoal, endereço, documentos ou dados bancários por aqui.
            </p>
          </div>
        </div>
        <hr className="my-6 border-paper/15" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-paper/60">
          <span>© {new Date().getFullYear()} Grupo WG</span>
          <span>Feito com carinho pelo time de Gente &amp; Gestão</span>
        </div>
      </div>
    </footer>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t-[1.5px] border-ink bg-paper/97 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-5">
        {NAV.map((n) => {
          const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold uppercase tracking-wide transition ${
                active ? "text-ink" : "text-muted-foreground"
              }`}
            >
              {active && <span className="absolute top-0 h-[3px] w-8 bg-primary" />}
              <Icon className="h-5 w-5" />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
