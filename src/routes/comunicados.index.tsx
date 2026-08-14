import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Archive, Megaphone, Pin } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { activeAnnouncementsQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

export const Route = createFileRoute("/comunicados/")({
  head: () => ({ meta: [{ title: "Comunicados — Portal WG" }] }),
  component: () => {
    const q = useQuery(activeAnnouncementsQuery);
    const items = q.data ?? [];
    return (
      <>
        <PageHeader eyebrow="Portal WG" title="Comunicados oficiais" description="Fique por dentro das novidades e informações importantes."
          action={<Link to="/comunicados/arquivo" className="inline-flex items-center gap-1.5 rounded-full border border-input bg-surface px-4 py-2 text-xs font-bold hover:bg-secondary"><Archive className="h-3.5 w-3.5" /> Arquivo</Link>} />
        {items.length === 0 ? <EmptyState title="Nenhum comunicado ativo." /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map(a => (
              <Link key={a.id} to="/comunicados/$id" params={{ id: a.id }} className="card-soft overflow-hidden hover:shadow-elevated hover:border-primary/40 transition group">
                {a.image_url && <img src={fileUrl(a.image_url) ?? ""} alt="" className="h-40 w-full object-cover" />}
                <div className="p-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.important && <span className="chip-accent"><AlertCircle className="h-3 w-3" /> Importante</span>}
                    {a.pinned && <span className="chip"><Pin className="h-3 w-3" /> Fixado</span>}
                    {a.category && <span className="text-[11px] font-semibold text-muted-foreground">{a.category}</span>}
                  </div>
                  <h3 className="mt-2 font-bold">{a.title}</h3>
                  {a.summary && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.summary}</p>}
                  {a.published_at && <div className="mt-3 text-[11px] font-semibold text-muted-foreground">{new Date(a.published_at).toLocaleDateString("pt-BR")}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5" /> Comunicados vencidos ficam no <Link to="/comunicados/arquivo" className="font-semibold text-primary underline">arquivo</Link>.
        </div>
      </>
    );
  },
});
