import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  activeAnnouncementsQuery,
  benefitsQuery,
  documentsQuery,
  faqQuery,
  jobsQuery,
  onboardingQuery,
  formsQuery,
  contactsQuery,
  campaignsQuery,
} from "@/lib/portal-queries";

const search = z.object({ q: z.string().optional() });

interface Result {
  kind: string;
  title: string;
  description?: string;
  to?: string;
  href?: string;
}

export const Route = createFileRoute("/_portal/busca")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Buscar — Portal WG" }] }),
  component: BuscaPage,
});

function BuscaPage() {
  const { q: initial } = Route.useSearch();
  const [q, setQ] = useState(initial ?? "");
  const ann = useQuery(activeAnnouncementsQuery);
  const ben = useQuery(benefitsQuery);
  const doc = useQuery(documentsQuery);
  const faq = useQuery(faqQuery);
  const job = useQuery(jobsQuery);
  const ob = useQuery(onboardingQuery);
  const frm = useQuery(formsQuery);
  const ctc = useQuery(contactsQuery);
  const cmp = useQuery(campaignsQuery);

  const results: Result[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const matches = (haystack: (string | null | undefined)[]) =>
      haystack.filter(Boolean).join(" ").toLowerCase().includes(s);
    const r: Result[] = [];
    (ann.data ?? []).forEach(
      (a) =>
        matches([a.title, a.summary, a.content, a.category, (a.tags ?? []).join(" ")]) &&
        r.push({
          kind: "Comunicado",
          title: a.title,
          description: a.summary ?? undefined,
          to: `/comunicados/${a.id}`,
        }),
    );
    (ben.data ?? []).forEach(
      (b) =>
        matches([b.title, b.description, b.eligibility]) &&
        r.push({
          kind: "Benefício",
          title: b.title,
          description: b.description ?? undefined,
          to: "/gente-gestao/beneficios",
        }),
    );
    (doc.data ?? []).forEach(
      (d) =>
        matches([d.title, d.description, d.category, (d.tags ?? []).join(" ")]) &&
        r.push({
          kind: "Documento",
          title: d.title,
          description: d.description ?? undefined,
          to: "/gente-gestao/documentos",
        }),
    );
    (faq.data ?? []).forEach(
      (f) =>
        matches([f.question, f.answer, f.category]) &&
        r.push({
          kind: "Dúvida",
          title: f.question,
          description: f.answer.slice(0, 120),
          to: "/gente-gestao/faq",
        }),
    );
    (job.data ?? []).forEach(
      (j) =>
        matches([j.title, j.location, j.summary, j.requirements]) &&
        r.push({
          kind: "Vaga",
          title: j.title,
          description: j.location ?? undefined,
          to: "/vagas",
        }),
    );
    (ob.data ?? []).forEach(
      (m) =>
        matches([m.title, m.description, m.content, m.category]) &&
        r.push({
          kind: "Integração",
          title: m.title,
          description: m.description ?? undefined,
          to: "/integracao",
        }),
    );
    (frm.data ?? []).forEach(
      (f) =>
        matches([f.title, f.description, f.category]) &&
        r.push({
          kind: "Formulário",
          title: f.title,
          description: f.description ?? undefined,
          href: f.external_url,
        }),
    );
    (ctc.data ?? []).forEach(
      (c) =>
        matches([c.name, c.area, c.description, c.email]) &&
        r.push({
          kind: "Contato",
          title: c.name,
          description: c.area ?? undefined,
          to: "/gente-gestao/contatos",
        }),
    );
    (cmp.data ?? []).forEach(
      (c) =>
        matches([c.title, c.description]) &&
        r.push({
          kind: "Campanha",
          title: c.title,
          description: c.description ?? undefined,
          to: "/cultura",
        }),
    );
    return r;
  }, [q, ann.data, ben.data, doc.data, faq.data, job.data, ob.data, frm.data, ctc.data, cmp.data]);

  return (
    <>
      <PageHeader
        eyebrow="Busca"
        title="Encontre o que procura"
        description="Comunicados, benefícios, documentos, vagas, formulários e mais."
      />
      <div className="flex items-center gap-2 rounded-full bg-surface border border-border shadow-card p-1.5 pl-5 max-w-2xl mb-6">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="O que você procura?"
          className="flex-1 bg-transparent outline-none py-2.5"
        />
      </div>
      {q.trim() === "" ? (
        <EmptyState
          title="Digite algo para buscar"
          description="Ex.: Wellhub, férias, Starbem, atestado..."
        />
      ) : results.length === 0 ? (
        <EmptyState title="Nada encontrado" description="Tente outros termos." />
      ) : (
        <div className="grid gap-3">
          {results.map((r, i) => {
            const inner = (
              <div className="card-soft p-4 hover:shadow-elevated hover:border-primary/40 transition">
                <span className="chip">{r.kind}</span>
                <div className="mt-2 font-bold">{r.title}</div>
                {r.description && (
                  <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {r.description}
                  </div>
                )}
              </div>
            );
            if (r.to)
              return (
                <Link key={i} to={r.to as "/"}>
                  {inner}
                </Link>
              );
            return (
              <a key={i} href={r.href} target="_blank" rel="noreferrer">
                {inner}
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
