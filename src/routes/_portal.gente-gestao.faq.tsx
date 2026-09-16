import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { GGBackLink } from "@/components/gg-page-view";
import { Chip, FilterPills, PageHeading, PaperCard } from "@/components/paper";
import { RichText } from "@/components/rich-text";
import { Skeleton } from "@/components/ui/skeleton";
import { faqQuery } from "@/lib/portal-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_portal/gente-gestao/faq")({
  head: () => ({ meta: [{ title: "Dúvidas Frequentes — Portal WG" }] }),
  component: FaqPage,
});

const ALL = "__todas__";

function FaqPage() {
  const q = useQuery(faqQuery);
  const [open, setOpen] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL);
  const items = useMemo(() => q.data ?? [], [q.data]);

  const categories = useMemo(() => {
    const set = new Set(items.map((f) => f.category?.trim()).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);
  const visible = category === ALL ? items : items.filter((f) => f.category?.trim() === category);

  return (
    <div>
      <GGBackLink />
      <PageHeading
        kicker="Gente & Gestão"
        title="Dúvidas frequentes."
        subtitle="Respostas rápidas — e tutoriais em vídeo — para as perguntas mais comuns."
      />

      {categories.length > 1 && (
        <FilterPills
          className="mt-7"
          options={[
            { value: ALL, label: "Todas" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
          value={category}
          onChange={setCategory}
        />
      )}

      {q.isLoading ? (
        <div className="mt-7 grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <PaperCard tone="soft" className="mt-7 p-8">
          <p className="text-lg font-black tracking-tight">Nenhuma dúvida cadastrada ainda.</p>
          <p className="mt-1.5 text-[15px] leading-[1.65] text-muted-foreground">
            Não achou o que procurava? Fale com o time de Gente &amp; Gestão.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-7 grid gap-3">
          {visible.map((f) => {
            const isOpen = open === f.id;
            return (
              <PaperCard key={f.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : f.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-accent-soft md:px-6"
                >
                  <span className="min-w-0">
                    {f.category && (
                      <Chip tone="soft" className="mb-2">
                        {f.category}
                      </Chip>
                    )}
                    <span className="block text-[16px] font-black leading-snug tracking-[-0.01em] md:text-[17px]">
                      {f.question}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180 text-ink",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-border px-5 pb-6 pt-4 md:px-6">
                    <RichText value={f.answer} className="max-w-[70ch]" />
                  </div>
                )}
              </PaperCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
