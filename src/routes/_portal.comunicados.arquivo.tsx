import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { archivedAnnouncementsQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/_portal/comunicados/arquivo")({
  head: () => ({ meta: [{ title: "Arquivo de comunicados — Portal WG" }] }),
  component: () => {
    const q = useQuery(archivedAnnouncementsQuery);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string>("");
    const categories = useMemo(() => Array.from(new Set((q.data ?? []).map(a => a.category).filter(Boolean) as string[])), [q.data]);
    const items = useMemo(() => {
      const s = search.trim().toLowerCase();
      return (q.data ?? []).filter(a => {
        if (category && a.category !== category) return false;
        if (!s) return true;
        return [a.title, a.summary, a.content, (a.tags ?? []).join(" ")].filter(Boolean).join(" ").toLowerCase().includes(s);
      });
    }, [q.data, search, category]);
    return (
      <>
        <PageHeader eyebrow="Comunicados" title="Arquivo de comunicados" description="Busque comunicados anteriores e vencidos." backTo="/comunicados" />
        <div className="grid gap-3 md:grid-cols-[1fr_220px] mb-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="rounded-full border border-input bg-surface px-5 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-full border border-input bg-surface px-5 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {items.length === 0 ? <EmptyState title="Nenhum comunicado encontrado." /> : (
          <div className="grid gap-2">
            {items.map(a => (
              <Link key={a.id} to="/comunicados/$id" params={{ id: a.id }} className="card-soft p-4 hover:shadow-elevated transition">
                <div className="text-[11px] font-semibold text-muted-foreground">{a.category ?? "Geral"} · {a.published_at ? new Date(a.published_at).toLocaleDateString("pt-BR") : ""}</div>
                <div className="font-bold">{a.title}</div>
              </Link>
            ))}
          </div>
        )}
      </>
    );
  },
});
