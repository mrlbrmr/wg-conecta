import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Star } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { documentsQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/gente-gestao/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Portal WG" }] }),
  component: () => {
    const q = useQuery(documentsQuery);
    const [search, setSearch] = useState("");
    const items = useMemo(() => {
      const list = q.data ?? [];
      const s = search.trim().toLowerCase();
      if (!s) return list;
      return list.filter(d =>
        [d.title, d.description, d.category, (d.tags ?? []).join(" ")].filter(Boolean).join(" ").toLowerCase().includes(s)
      );
    }, [q.data, search]);
    return (
      <>
        <PageHeader eyebrow="Gente & Gestão" title="Documentos e políticas" description="Encontre documentos, políticas e materiais de apoio." backTo="/gente-gestao" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, categoria ou tag..."
          className="mb-4 w-full rounded-full border border-input bg-surface px-5 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        {items.length === 0 ? <EmptyState title="Nenhum documento encontrado." /> : (
          <div className="grid gap-3">
            {items.map(d => (
              <a key={d.id} href={fileUrl(d.file_url) ?? "#"} target="_blank" rel="noreferrer"
                className="card-soft p-4 md:p-5 flex items-center gap-4 hover:shadow-elevated hover:border-primary/40 transition">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-softer text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {d.featured && <span className="chip-accent"><Star className="h-3 w-3" /> Destaque</span>}
                    {d.category && <span className="text-[11px] font-semibold text-muted-foreground">{d.category}</span>}
                  </div>
                  <div className="mt-0.5 font-bold truncate">{d.title}</div>
                  {d.description && <div className="text-xs text-muted-foreground truncate">{d.description}</div>}
                </div>
                <div className="shrink-0 rounded-full bg-secondary p-2.5 text-primary"><Download className="h-4 w-4" /></div>
              </a>
            ))}
          </div>
        )}
      </>
    );
  },
});
