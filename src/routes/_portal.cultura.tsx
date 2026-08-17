import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cake, Award, Sparkles, PartyPopper, ExternalLink } from "lucide-react";
import { PortalLayout } from "@/components/portal-layout";
import { PageHeader } from "@/components/page-header";
import {
  birthdaysQuery, anniversariesQuery, recognitionsQuery, campaignsQuery,
} from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function yearsFrom(date: string) {
  const d = new Date(date);
  const now = new Date();
  let y = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) y--;
  return y;
}

export const Route = createFileRoute("/_portal/cultura")({
  head: () => ({ meta: [{ title: "Cultura — Portal WG" }] }),
  component: () => {
    const bd = useQuery(birthdaysQuery);
    const wa = useQuery(anniversariesQuery);
    const rec = useQuery(recognitionsQuery);
    const cmp = useQuery(campaignsQuery);
    const currentMonth = new Date().getMonth() + 1;
    const bdMonth = (bd.data ?? []).filter(b => b.birthday_month === currentMonth);
    const waMonth = (wa.data ?? []).filter(w => new Date(w.admission_date).getMonth() + 1 === currentMonth);

    return (
      <PortalLayout>
        <PageHeader eyebrow="Cultura WG" title="Nossa gente, nossa cultura" description="Aniversariantes, tempo de casa, reconhecimentos e campanhas." />

        {(cmp.data ?? []).length > 0 && (
          <section className="mb-8">
            <SectionTitle icon={Sparkles} title="Campanhas em destaque" />
            <div className="grid gap-4 md:grid-cols-2">
              {(cmp.data ?? []).map(c => (
                <article key={c.id} className="card-soft overflow-hidden">
                  {c.image_url && <img src={fileUrl(c.image_url) ?? ""} alt="" className="h-40 w-full object-cover" />}
                  <div className="p-5">
                    <h3 className="font-bold">{c.title}</h3>
                    {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                    {c.external_url && <a href={c.external_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Saiba mais <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <SectionTitle icon={Cake} title={`Aniversariantes de ${MONTHS[currentMonth - 1]}`} />
          {bdMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground card-soft p-6 text-center">Nenhum aniversariante neste mês.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {bdMonth.map(b => (
                <div key={b.id} className="card-soft p-4 flex items-center gap-3">
                  {b.photo_url ? <img src={fileUrl(b.photo_url) ?? ""} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-foreground"><Cake className="h-5 w-5" /></div>}
                  <div className="min-w-0">
                    <div className="font-bold truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground">Dia {b.birthday_day} {b.role ? `· ${b.role}` : ""}</div>
                    {b.unit && <div className="text-[11px] font-bold truncate">{b.unit}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(bd.data ?? []).length > bdMonth.length && (
            <details className="mt-4 card-soft p-4">
              <summary className="cursor-pointer text-sm font-bold">Ver todos os aniversariantes do ano ({(bd.data ?? []).length})</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {(bd.data ?? []).filter(b => b.birthday_month !== currentMonth).map(b => (
                  <div key={b.id} className="flex items-center gap-3">
                    {b.photo_url ? <img src={fileUrl(b.photo_url) ?? ""} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent-foreground"><Cake className="h-4 w-4" /></div>}
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{MONTHS[b.birthday_month - 1]}, dia {b.birthday_day}{b.role ? ` · ${b.role}` : ""}</div>
                      {b.unit && <div className="text-[11px] font-bold truncate">{b.unit}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        <section className="mb-8">
          <SectionTitle icon={PartyPopper} title={`Tempo de casa em ${MONTHS[currentMonth - 1]}`} />
          {waMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground card-soft p-6 text-center">Nenhum aniversário de casa neste mês.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {waMonth.map(w => (
                <div key={w.id} className="card-soft p-4 flex items-center gap-3">
                  {w.photo_url ? <img src={fileUrl(w.photo_url) ?? ""} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-softer text-primary"><PartyPopper className="h-5 w-5" /></div>}
                  <div className="min-w-0">
                    <div className="font-bold truncate">{w.name}</div>
                    <div className="text-xs text-muted-foreground">{yearsFrom(w.admission_date)} {yearsFrom(w.admission_date) === 1 ? "ano" : "anos"} de casa {w.role ? `· ${w.role}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(wa.data ?? []).length > waMonth.length && (
            <details className="mt-4 card-soft p-4">
              <summary className="cursor-pointer text-sm font-bold">Ver todos os aniversários de casa ({(wa.data ?? []).length})</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {(wa.data ?? []).filter(w => new Date(w.admission_date).getMonth() + 1 !== currentMonth).sort((a, b) => {
                    const da = new Date(a.admission_date), db = new Date(b.admission_date);
                    return da.getMonth() - db.getMonth() || da.getDate() - db.getDate();
                  }).map(w => {
                  const d = new Date(w.admission_date);
                  return (
                    <div key={w.id} className="flex items-center gap-3">
                      {w.photo_url ? <img src={fileUrl(w.photo_url) ?? ""} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-softer text-primary"><PartyPopper className="h-4 w-4" /></div>}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{w.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{d.getDate()} de {MONTHS[d.getMonth()].toLowerCase()}</span>
                          <span className="text-xs font-bold text-primary bg-primary-softer px-2 py-0.5 rounded-full">{yearsFrom(w.admission_date)} {yearsFrom(w.admission_date) === 1 ? "ano" : "anos"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </section>


        {(rec.data ?? []).length > 0 && (
          <section>
            <SectionTitle icon={Award} title="Reconhecimentos" />
            <div className="grid gap-3 md:grid-cols-2">
              {(rec.data ?? []).map(r => (
                <article key={r.id} className="card-soft p-5 flex gap-4">
                  {r.image_url && <img src={fileUrl(r.image_url) ?? ""} alt="" className="h-16 w-16 rounded-2xl object-cover shrink-0" />}
                  <div className="min-w-0">
                    <span className="chip-accent">{r.person_or_team}</span>
                    <h3 className="mt-2 font-bold">{r.title}</h3>
                    {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </PortalLayout>
    );
  },
});

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-softer text-primary"><Icon className="h-4 w-4" /></div>
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
    </div>
  );
}
