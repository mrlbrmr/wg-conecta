import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/page-header";
import { faqQuery } from "@/lib/portal-queries";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/gente-gestao/faq")({
  head: () => ({ meta: [{ title: "Dúvidas Frequentes — Portal WG" }] }),
  component: () => {
    const q = useQuery(faqQuery);
    const [open, setOpen] = useState<string | null>(null);
    const items = q.data ?? [];
    return (
      <>
        <PageHeader eyebrow="Gente & Gestão" title="Dúvidas frequentes" description="Respostas rápidas para as perguntas mais comuns." backTo="/gente-gestao" />
        {items.length === 0 ? <EmptyState title="Sem dúvidas cadastradas." /> : (
          <div className="grid gap-2">
            {items.map(f => (
              <div key={f.id} className="card-soft overflow-hidden">
                <button onClick={() => setOpen(open === f.id ? null : f.id)} className="w-full flex items-center justify-between gap-4 p-5 text-left">
                  <div className="min-w-0">
                    {f.category && <span className="chip mb-1.5">{f.category}</span>}
                    <div className="font-bold text-sm md:text-base">{f.question}</div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition ${open === f.id ? "rotate-180" : ""}`} />
                </button>
                {open === f.id && <div className="px-5 pb-5 text-sm text-muted-foreground whitespace-pre-line">{f.answer}</div>}
              </div>
            ))}
          </div>
        )}
      </>
    );
  },
});
