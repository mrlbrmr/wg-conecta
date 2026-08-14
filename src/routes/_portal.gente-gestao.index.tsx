import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { GG_LINKS } from "./_portal.gente-gestao";
import { Gift, FolderOpen, HelpCircle, CalendarDays, FileWarning, UserCog, Wallet, ScrollText, Users } from "lucide-react";

const ICONS = [Gift, FolderOpen, HelpCircle, CalendarDays, FileWarning, UserCog, Wallet, ScrollText, Users];

export const Route = createFileRoute("/_portal/gente-gestao/")({
  head: () => ({ meta: [{ title: "Gente & Gestão — Portal do Colaborador WG" }] }),
  component: () => (
    <>
      <PageHeader eyebrow="Gente & Gestão" title="Tudo que você precisa do RH" description="Encontre benefícios, documentos, orientações e canais de contato." />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {GG_LINKS.map((l, i) => {
          const Icon = ICONS[i] ?? Users;
          return (
            <Link key={l.to} to={l.to} className="card-soft p-5 hover:shadow-elevated hover:border-primary/40 transition group">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-softer text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-base font-bold">{l.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
            </Link>
          );
        })}
      </div>
    </>
  ),
});
