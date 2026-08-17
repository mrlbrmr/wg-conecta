import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, ExternalLink } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { PortalLayout } from "@/components/portal-layout";
import { PageHeader, EmptyState } from "@/components/page-header";
import { formsQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/_portal/formularios")({
  head: () => ({ meta: [{ title: "Formulários — Portal WG" }] }),
  component: () => {
    const q = useQuery(formsQuery);
    const [category, setCategory] = useState("");
    const items = q.data ?? [];
    const categories = useMemo(() => Array.from(new Set(items.map(f => f.category).filter(Boolean) as string[])), [items]);
    const filtered = category ? items.filter(f => f.category === category) : items;
    return (
      <PortalLayout>
        <PageHeader eyebrow="Portal WG" title="Formulários" description="Links úteis para solicitações do dia a dia." />
        {categories.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setCategory("")} className={`chip ${!category ? "!bg-primary !text-primary-foreground" : ""}`}>Todos</button>
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`chip ${category === c ? "!bg-primary !text-primary-foreground" : ""}`}>{c}</button>
            ))}
          </div>
        )}
        {filtered.length === 0 ? <EmptyState title="Nenhum formulário nesta categoria." /> : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {filtered.map(f => (
              <a key={f.id} href={f.external_url} target="_blank" rel="noreferrer"
                className="card-soft p-5 flex flex-col gap-3 hover:shadow-elevated hover:border-primary/40 transition group">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-softer text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  {(() => { const I = ICON_MAP[f.icon ?? ""] ?? ClipboardList; return <I className="h-5 w-5" />; })()}
                </div>
                <div>
                  {f.category && <span className="text-[11px] font-semibold text-muted-foreground">{f.category}</span>}
                  <div className="font-bold">{f.title}</div>
                  {f.description && <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>}
                </div>
                <div className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-primary">Abrir <ExternalLink className="h-3 w-3" /></div>
              </a>
            ))}
          </div>
        )}
      </PortalLayout>
    );
  },
});
