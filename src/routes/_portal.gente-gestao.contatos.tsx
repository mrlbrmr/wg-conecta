import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { Chip, Kicker, PageHeading, PaperCard } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useCurrentEmployee } from "@/hooks/use-current-employee";
import { contactMatrixQuery, matrixDepartments, matrixFor, type MatrixRow } from "@/lib/contact-matrix";
import { DEPARTMENTS } from "@/lib/org";
import { contactsQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/_portal/gente-gestao/contatos")({
  head: () => ({ meta: [{ title: "Com quem falar — Portal WG" }] }),
  component: ContatosPage,
});

function ContatosPage() {
  const me = useCurrentEmployee();
  const matrix = useQuery(contactMatrixQuery);
  const gg = useQuery(contactsQuery);

  const rows = matrix.data ?? [];
  const departments = useMemo(() => {
    const all = new Map<string, string>();
    for (const d of [...DEPARTMENTS, ...matrixDepartments(rows)]) all.set(d.toLowerCase(), d);
    return [...all.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  // Começa na área de quem está logado; dá para ver a de outra área.
  const [department, setDepartment] = useState("");
  const myDepartment = me.data?.department ?? "";
  useEffect(() => {
    if (myDepartment) setDepartment((d) => d || myDepartment);
  }, [myDepartment]);

  const subjects = matrixFor(rows, department);
  const isMine = Boolean(department) && department === myDepartment;

  return (
    <div>
      <PageHeading
        kicker="Gente & Gestão"
        title="Com quem falar."
        subtitle="Para cada assunto, o contato certo para a sua área. Não achou o assunto? Fale com o time de Gente & Gestão, logo abaixo."
      />

      {(matrix.isLoading || rows.length > 0) && (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Kicker>{isMine ? "Para a sua área" : department ? "Para a área" : "Para todos"}</Kicker>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                {department || "Escolha uma área"}
              </h2>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              Ver a matriz de
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-[42px] min-w-[220px] rounded-full border-[1.5px] border-ink bg-surface px-4 text-[14px] font-bold outline-none focus-visible:outline-2 focus-visible:outline-primary"
              >
                <option value="">Contatos gerais</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {d === myDepartment ? " (sua área)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {matrix.isLoading ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : subjects.length === 0 ? (
            <PaperCard tone="soft" className="mt-5 p-6">
              <p className="text-[15px] leading-[1.65] text-muted-foreground">
                Ainda não há contatos cadastrados para esta área.
              </p>
            </PaperCard>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((s) => (
                <PaperCard key={s.subject} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[19px] font-black leading-tight tracking-[-0.02em]">
                      {s.subject}
                    </p>
                    {department && (
                      <Chip tone={s.specific ? "accent" : "soft"} className="shrink-0">
                        {s.specific ? "Da área" : "Geral"}
                      </Chip>
                    )}
                  </div>
                  <ul className="mt-3 flex flex-col gap-4">
                    {s.contacts.map((c) => (
                      <MatrixContact key={c.id} contact={c} />
                    ))}
                  </ul>
                </PaperCard>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-12">
        <Kicker>Time de Gente &amp; Gestão</Kicker>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
          Fale com Gente &amp; Gestão
        </h2>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-[1.65] text-muted-foreground">
          Dúvidas sobre benefícios, férias, atestados e demais assuntos de Gente &amp; Gestão.
        </p>
        {gg.isLoading ? (
          <Skeleton className="mt-5 h-28 w-full" />
        ) : (gg.data ?? []).length === 0 ? (
          <PaperCard tone="soft" className="mt-5 p-6">
            <p className="text-[15px] text-muted-foreground">Nenhum contato cadastrado.</p>
          </PaperCard>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(gg.data ?? []).map((c) => (
              <PaperCard key={c.id} className="flex gap-4 p-5">
                <UserAvatar name={c.name} photoUrl={c.photo_url} size={56} tone="muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-extrabold">{c.name}</p>
                  {c.description && (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{c.description}</p>
                  )}
                  <ContactLinks email={c.email} phone={c.phone} />
                </div>
              </PaperCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MatrixContact({ contact: c }: { contact: MatrixRow }) {
  return (
    <li>
      <p className="text-[15px] font-extrabold">{c.contact_name}</p>
      {c.contact_role && <p className="text-[13px] text-muted-foreground">{c.contact_role}</p>}
      <ContactLinks email={c.email} phone={c.phone} extension={c.extension} />
      {c.notes && <p className="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">{c.notes}</p>}
    </li>
  );
}

function ContactLinks({
  email,
  phone,
  extension,
}: {
  email?: string | null;
  phone?: string | null;
  extension?: string | null;
}) {
  if (!email && !phone && !extension) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {extension && <Chip tone="soft">Ramal {extension}</Chip>}
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="chip inline-flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {phone}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className="chip inline-flex max-w-full items-center gap-1 truncate">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{email}</span>
        </a>
      )}
    </div>
  );
}
