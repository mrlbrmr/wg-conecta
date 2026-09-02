import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Pin,
  Search,
  ArrowUpRight,
  AlertCircle,
  Cake,
  Award,
  Sparkles,
  Coffee,
} from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activeAnnouncementsQuery,
  portalSettingsQuery,
  quickLinksQuery,
  birthdaysQuery,
} from "@/lib/portal-queries";

export const Route = createFileRoute("/_portal/")({
  component: HomePage,
});

function HomePage() {
  const settings = useQuery(portalSettingsQuery);
  const links = useQuery(quickLinksQuery);
  const announcements = useQuery(activeAnnouncementsQuery);
  const birthdays = useQuery(birthdaysQuery);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const now = new Date();
  const monthBirthdays = (birthdays.data ?? []).filter(
    (b) => b.birthday_month === now.getMonth() + 1,
  );

  const featured =
    (announcements.data ?? []).find((a) => a.pinned || a.important) ??
    (announcements.data ?? [])[0];
  const rest = (announcements.data ?? []).filter((a) => a.id !== featured?.id).slice(0, 3);

  return (
    <>
      {/* Cabeçalho editorial */}
      <section className="border-b-[1.5px] border-ink pb-8">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <span className="kicker">Ed. de hoje · WG Baterias</span>
            <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tighter leading-[0.95]">
              {greet}, <span className="italic font-black text-primary">time WG</span>.
              <br />O que rola por aqui hoje.
            </h1>
          </div>
          <div className="hidden md:block text-right text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground max-w-[220px]">
            {settings.data?.welcome_text ??
              "Comunicação, benefícios, cultura e o que mais o dia pedir — no nosso ritmo."}
          </div>
        </div>

        <form
          action="/busca"
          method="get"
          className="mt-6 flex items-center gap-0 border-[1.5px] border-ink bg-surface max-w-2xl overflow-hidden"
        >
          <Search className="h-4 w-4 text-ink shrink-0 ml-4" />
          <input
            name="q"
            placeholder="Procurando benefícios, holerite, atestado, uma vaga…"
            className="min-w-0 flex-1 bg-transparent outline-none text-sm px-3 py-3.5 placeholder:text-muted-foreground"
          />
          <button type="submit" className="btn-ink rounded-none border-0 py-3.5 px-5 h-full">
            Buscar
          </button>
        </form>
      </section>

      {/* MURAL — bento editorial */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <span className="kicker">Mural</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tighter">
              O que tá no ar hoje
            </h2>
          </div>
          <Link
            to="/comunicados"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:text-primary"
          >
            Mural completo <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* MANCHETE — comunicado em destaque */}
          {announcements.isLoading ? (
            <div className="col-span-12 lg:col-span-8 card-paper overflow-hidden">
              <div className="p-6 md:p-8 space-y-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-11 w-40 rounded-full mt-2" />
              </div>
            </div>
          ) : featured ? (
            <article className="col-span-12 lg:col-span-8 card-paper card-paper-hover bg-ink text-paper overflow-hidden flex flex-col">
              <div className="p-6 md:p-8 flex-1 flex flex-col">
                {/* Kicker */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                    Manchete
                  </span>
                  <span className="h-1 w-1 rounded-full bg-paper/40" />
                  {featured.important && (
                    <span className="chip-accent">
                      <AlertCircle className="h-3 w-3" /> Importante
                    </span>
                  )}
                  {featured.pinned && (
                    <span className="chip">
                      <Pin className="h-3 w-3" /> Fixado
                    </span>
                  )}
                  {featured.category && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/70 truncate max-w-[10rem]">
                      {featured.category}
                    </span>
                  )}
                </div>

                {/* Título */}
                <h3 className="mt-4 text-[26px] leading-[1.05] sm:text-4xl md:text-5xl md:leading-[1] font-black tracking-tighter">
                  {featured.title}
                </h3>

                {/* Subtítulo */}
                {featured.summary && (
                  <p className="mt-3 text-paper/75 text-[15px] sm:text-base md:text-lg leading-relaxed line-clamp-3 max-w-2xl">
                    {featured.summary}
                  </p>
                )}

                {/* Data + CTA */}
                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 sm:mt-auto sm:pt-6">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-paper/60 order-2 sm:order-1">
                    {featured.published_at
                      ? new Date(featured.published_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                        })
                      : "Publicado agora"}
                  </div>
                  <Link
                    to="/comunicados/$id"
                    params={{ id: featured.id }}
                    className="order-1 sm:order-2 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-accent text-ink px-5 py-3 text-sm font-black uppercase tracking-wider border-[1.5px] border-accent hover:bg-paper hover:border-paper transition"
                  >
                    Ler comunicado <ArrowUpRight className="h-4 w-4 shrink-0" />
                  </Link>
                </div>
              </div>
            </article>
          ) : (
            <div className="col-span-12 lg:col-span-8 card-paper p-6 md:p-8 text-sm text-muted-foreground">
              Ainda não temos comunicados publicados. Novidades chegam por aqui.
            </div>
          )}

          {/* ANIVERSARIANTES — cartão verde elétrico */}
          <article className="col-span-12 lg:col-span-4 card-paper card-paper-hover bg-accent p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em]">
                Aniversariantes · este mês
              </span>
              <Cake className="h-5 w-5" />
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <div className="text-[56px] sm:text-6xl md:text-7xl font-black leading-none tracking-tighter tabular-nums">
                {monthBirthdays.length}
              </div>
              <div className="text-base sm:text-lg font-black leading-tight">
                {monthBirthdays.length === 1 ? "colega" : "colegas"} pra celebrar
              </div>
            </div>

            <p className="mt-3 text-sm text-ink/70 leading-relaxed">
              Nada como um bolo, um abraço e um "parabéns" de corredor.
            </p>

            {monthBirthdays.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm border-t-[1.5px] border-ink/20 pt-4">
                {monthBirthdays.slice(0, 3).map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <span className="inline-flex flex-col items-center justify-center h-10 w-10 rounded-full bg-ink text-accent shrink-0 leading-none">
                      <span className="text-[8px] font-bold uppercase opacity-70 tracking-wide">
                        dia
                      </span>
                      <span className="text-sm font-black tabular-nums">
                        {String(b.birthday_day).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="truncate font-bold min-w-0">{b.name}</span>
                  </li>
                ))}
                {monthBirthdays.length > 3 && (
                  <li className="text-xs font-bold uppercase tracking-wider text-ink/60 pl-11">
                    + {monthBirthdays.length - 3} colegas
                  </li>
                )}
              </ul>
            )}

            <Link
              to="/cultura"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink text-accent px-4 py-3 text-xs font-black uppercase tracking-wider border-[1.5px] border-ink hover:-translate-y-0.5 transition"
            >
              Ver todo mundo <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </article>

          {/* Comunicados secundários — cartões editoriais */}
          {announcements.isLoading
            ? [0, 1].map((i) => (
                <div
                  key={i}
                  className="col-span-12 sm:col-span-6 lg:col-span-4 card-paper p-6 space-y-4"
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-11 w-full rounded-full mt-2" />
                </div>
              ))
            : rest.slice(0, 2).map((a) => (
                <article
                  key={a.id}
                  className="col-span-12 sm:col-span-6 lg:col-span-4 card-paper card-paper-hover p-6 flex flex-col"
                >
                  {/* Kicker */}
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary flex-wrap">
                    <span className="truncate max-w-[10rem]">{a.category ?? "Comunicado"}</span>
                    {a.published_at && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-ink/30" />
                        <span className="text-muted-foreground">
                          {new Date(a.published_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Título */}
                  <h3 className="mt-4 text-xl sm:text-2xl font-black leading-[1.1] tracking-tight">
                    {a.title}
                  </h3>

                  {/* Subtítulo */}
                  {a.summary && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-3 leading-relaxed flex-1">
                      {a.summary}
                    </p>
                  )}

                  {/* CTA */}
                  <Link
                    to="/comunicados/$id"
                    params={{ id: a.id }}
                    className="mt-6 inline-flex w-full sm:w-auto self-stretch sm:self-start items-center justify-center gap-2 rounded-full border-[1.5px] border-ink bg-surface px-4 py-3 text-xs font-black uppercase tracking-wider hover:bg-accent transition"
                  >
                    Ler agora <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                </article>
              ))}

          {/* RECADO DE G&G */}
          <article className="col-span-12 sm:col-span-6 lg:col-span-4 card-paper card-paper-hover bg-primary text-primary-foreground p-6 flex flex-col">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
              <Coffee className="h-4 w-4" />
              Recado do G&amp;G
            </div>

            <h3 className="mt-4 text-xl sm:text-2xl font-black leading-[1.1] tracking-tight">
              A gente responde o mais rápido possível.
            </h3>

            <p className="mt-3 text-sm text-primary-foreground/80 leading-relaxed flex-1">
              Benefício, férias, documento, dúvida boba — manda pra gente sem cerimônia.
            </p>

            <Link
              to="/gente-gestao/contatos"
              className="mt-6 inline-flex w-full sm:w-auto self-stretch sm:self-start items-center justify-center gap-2 rounded-full bg-accent text-ink px-4 py-3 text-xs font-black uppercase tracking-wider border-[1.5px] border-accent hover:bg-paper hover:border-paper transition"
            >
              Falar com o time <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </Link>
          </article>
        </div>

        <Link
          to="/comunicados"
          className="sm:hidden mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary"
        >
          Ver mural completo <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      {/* Atalhos rápidos — estilo mural com cartões preto+verde */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <span className="kicker">Onde a gente vai agora</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {(links.data ?? []).map((link) => {
            const Icon = ICON_MAP[link.icon ?? ""] ?? Sparkles;
            const isInternal = link.url.startsWith("/");
            const content = (
              <div className="card-paper card-paper-hover p-5 h-full flex flex-col group">
                <div className="inline-grid h-11 w-11 place-items-center rounded-md bg-ink text-accent border-[1.5px] border-ink">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-black tracking-tight">{link.title}</div>
                {link.description && (
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2 flex-1">
                    {link.description}
                  </div>
                )}
                <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-primary inline-flex items-center gap-1">
                  Abrir{" "}
                  <ArrowUpRight className="h-3 w-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            );
            return isInternal ? (
              <Link key={link.id} to={link.url as "/"} className="block">
                {content}
              </Link>
            ) : (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="block">
                {content}
              </a>
            );
          })}
        </div>
      </section>

      {/* Nota de rodapé editorial */}
      <section className="mt-14 border-t-[1.5px] border-ink pt-8">
        <div className="flex items-start gap-4">
          <Award className="h-6 w-6 text-primary shrink-0 mt-1" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Jeito WG de ser
            </div>
            <p className="mt-1 text-lg md:text-xl font-black tracking-tight max-w-3xl leading-snug">
              A gente move baterias — e move gente também. Cada colaborador aqui é parte da corrente
              que faz o Grupo WG acontecer todo dia.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
