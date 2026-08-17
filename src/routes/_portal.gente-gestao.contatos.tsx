import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, User } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { contactsQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

export const Route = createFileRoute("/_portal/gente-gestao/contatos")({
  head: () => ({ meta: [{ title: "Contatos G&G — Portal WG" }] }),
  component: () => {
    const q = useQuery(contactsQuery);
    const items = q.data ?? [];
    return (
      <>
        <PageHeader eyebrow="Gente & Gestão" title="Fale com Gente & Gestão" description="Fale conosco para dúvidas sobre benefícios, férias, atestados e demais assuntos de Gente & Gestão." backTo="/gente-gestao" />
        {items.length === 0 ? <EmptyState title="Nenhum contato cadastrado." /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(c => (
              <div key={c.id} className="card-soft p-5 flex gap-4">
                {c.photo_url ? (
                  <img src={fileUrl(c.photo_url) ?? ""} alt={c.name} className="h-14 w-14 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary-softer text-primary"><User className="h-6 w-6" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">{c.name}</div>
                  {c.area && <div className="text-xs text-muted-foreground">{c.area}</div>}
                  {c.description && <div className="text-xs text-muted-foreground mt-1">{c.description}</div>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.email && <a href={`mailto:${c.email}`} className="chip inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</a>}
                    {c.phone && <a href={`tel:${c.phone}`} className="chip inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  },
});
