import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText, Search, Star } from "lucide-react";
import { GGBackLink } from "@/components/gg-page-view";
import { Chip, IconBubble, PageHeading, PaperCard } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { documentsQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

export const Route = createFileRoute("/_portal/gente-gestao/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Portal WG" }] }),
  component: DocumentosPage,
});

function DocumentosPage() {
  const q = useQuery(documentsQuery);
  const [search, setSearch] = useState("");
  const items = useMemo(() => {
    const list = q.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((d) =>
      [d.title, d.description, d.category, (d.tags ?? []).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [q.data, search]);

  return (
    <div>
      <GGBackLink />
      <PageHeading
        kicker="Gente & Gestão"
        title="Documentos e políticas."
        subtitle="Encontre documentos, políticas e materiais de apoio."
      />

      <label className="mt-7 flex max-w-2xl items-center overflow-hidden rounded-full border-[1.5px] border-ink bg-surface focus-within:ring-2 focus-within:ring-primary/30">
        <Search className="ml-4 h-4 w-4 shrink-0" />
        <span className="sr-only">Buscar documentos</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, categoria ou tag…"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {q.isLoading ? (
        <div className="mt-6 grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px] w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <PaperCard tone="soft" className="mt-6 p-8">
          <p className="text-lg font-black tracking-tight">
            {search.trim() ? "Nenhum documento encontrado." : "Nenhum documento cadastrado ainda."}
          </p>
        </PaperCard>
      ) : (
        <div className="mt-6 grid gap-3">
          {items.map((d) => (
            <PaperCard key={d.id} hover asChild>
              <a
                href={fileUrl(d.file_url) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 md:p-5"
              >
                <IconBubble size={44}>
                  <FileText />
                </IconBubble>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {d.featured && (
                      <Chip tone="accent">
                        <Star className="h-3 w-3" /> Destaque
                      </Chip>
                    )}
                    {d.category && (
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                        {d.category}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[16px] font-extrabold tracking-[-0.01em]">
                    {d.title}
                  </span>
                  {d.description && (
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {d.description}
                    </span>
                  )}
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-ink">
                  <Download className="h-4 w-4" />
                </span>
              </a>
            </PaperCard>
          ))}
        </div>
      )}
    </div>
  );
}
