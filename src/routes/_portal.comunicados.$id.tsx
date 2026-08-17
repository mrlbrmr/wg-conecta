import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, Calendar, Paperclip, Pin } from "lucide-react";
import { PortalLayout } from "@/components/portal-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { announcementByIdQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

export const Route = createFileRoute("/_portal/comunicados/$id")({
  head: () => ({ meta: [{ title: "Comunicado — Portal WG" }] }),
  component: AnnouncementDetail,
});

function AnnouncementDetail() {
  const { id } = Route.useParams();
  const q = useQuery(announcementByIdQuery(id));
  const a = q.data;

  if (q.isLoading) {
    return (
      <PortalLayout>
        <Skeleton className="h-4 w-28 mb-6" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 card-paper overflow-hidden">
            <Skeleton className="h-52 w-full rounded-none rounded-t-lg" />
            <div className="p-6 md:p-10 space-y-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-11 w-40 rounded-full mt-2" />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-52 w-full rounded-lg" />
          </div>
        </div>
      </PortalLayout>
    );
  }
  if (!a) {
    return (
      <PortalLayout>
        <div className="card-paper p-8">
          <p className="text-sm font-bold">Comunicado não encontrado.</p>
          <Link to="/comunicados" className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
            Voltar ao mural <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PortalLayout>
    );
  }

  const publishedLabel = a.published_at
    ? new Date(a.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const attachmentHref = a.attachment_url ? fileUrl(a.attachment_url) : null;

  return (
    <PortalLayout>
      {/* Voltar */}
      <Link
        to="/comunicados"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary transition mb-6"
      >
        ← Mural de comunicados
      </Link>

      <article className="grid grid-cols-12 gap-6">
        {/* Manchete */}
        <header className="col-span-12 lg:col-span-8 card-paper bg-ink text-paper overflow-hidden">
          {a.image_url && (
            <img
              src={fileUrl(a.image_url) ?? ""}
              alt=""
              className="w-full max-h-80 object-cover border-b-[1.5px] border-paper/20"
            />
          )}
          <div className="p-6 md:p-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                {a.category ?? "Comunicado"}
              </span>
              {a.important && (
                <span className="chip-accent"><AlertCircle className="h-3 w-3" /> Importante</span>
              )}
              {a.pinned && (
                <span className="chip"><Pin className="h-3 w-3" /> Fixado</span>
              )}
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-[1.02]">
              {a.title}
            </h1>

            {a.summary && (
              <p className="mt-4 text-base md:text-lg text-paper/80 leading-relaxed max-w-3xl">
                {a.summary}
              </p>
            )}

            {publishedLabel && (
              <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-paper/60">
                <Calendar className="h-3.5 w-3.5" /> {publishedLabel}
              </div>
            )}
          </div>
        </header>

        {/* Sidebar de ações */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          {attachmentHref && (
            <a
              href={attachmentHref}
              target="_blank"
              rel="noreferrer"
              className="card-paper card-paper-hover bg-accent p-6 block group"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em]">
                <Paperclip className="h-4 w-4" /> Anexo
              </div>
              <div className="mt-3 text-xl font-black leading-tight tracking-tight">
                Acessar conteúdo completo
              </div>
              <p className="mt-2 text-sm text-ink/70 leading-relaxed">
                Abre o material que acompanha esse comunicado.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink text-accent px-4 py-3 text-xs font-black uppercase tracking-wider border-[1.5px] border-ink group-hover:-translate-y-0.5 transition">
                Abrir agora <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </a>
          )}

          <div className="card-paper p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Ficha do comunicado
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              {a.category && (
                <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoria</dt>
                  <dd className="font-bold text-right">{a.category}</dd>
                </div>
              )}
              {publishedLabel && (
                <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Publicado</dt>
                  <dd className="font-bold text-right">{publishedLabel}</dd>
                </div>
              )}
              {a.expires_at && (
                <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vale até</dt>
                  <dd className="font-bold text-right">
                    {new Date(a.expires_at).toLocaleDateString("pt-BR")}
                  </dd>
                </div>
              )}
              {a.tags && a.tags.length > 0 && (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Tags</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {a.tags.map(t => <span key={t} className="chip">{t}</span>)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <Link
            to="/comunicados"
            className="card-paper card-paper-hover p-5 block group"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Mural</div>
            <div className="mt-2 text-sm font-black inline-flex items-center gap-2">
              Ver outros comunicados
              <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
        </aside>

        {/* Conteúdo completo */}
        {a.content && (
          <section className="col-span-12 lg:col-span-8 card-paper p-6 md:p-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Na íntegra
            </div>
            <div className="mt-4 prose prose-sm md:prose-base max-w-none whitespace-pre-line leading-relaxed">
              {a.content}
            </div>
          </section>
        )}
      </article>
    </PortalLayout>
  );
}
