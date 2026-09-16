import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ProfileRequestQueue } from "@/components/admin/profile-request-queue";
import { RequestQueue } from "@/components/admin/request-queue";
import { AdminPageHeader } from "@/components/paper";
import { openRequestsQuery, pendingProfileRequestsQuery } from "@/lib/admin-queries";
import { cn } from "@/lib/utils";

/**
 * Fila única do G&G.
 *
 * São duas origens com ciclos de vida diferentes — os formulários do portal
 * (`requests`, com protocolo, prazo e conversa) e a atualização cadastral
 * (`profile_update_requests`, com diff e aprovação que aplica no cadastro). O
 * time olha um lugar só; cada aba mantém o fluxo que já tinha.
 */

const QUEUES = [
  { value: "formularios", label: "Formulários" },
  { value: "cadastral", label: "Atualização cadastral" },
] as const;

type Queue = (typeof QUEUES)[number]["value"];

export const Route = createFileRoute("/_authenticated/admin/solicitacoes")({
  head: () => ({ meta: [{ title: "Solicitações — Portal WG" }] }),
  validateSearch: z.object({ fila: z.enum(["formularios", "cadastral"]).optional() }),
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  const { fila = "formularios" } = Route.useSearch();
  const navigate = Route.useNavigate();

  const pendingProfile = useQuery(pendingProfileRequestsQuery);
  const openRequests = useQuery(openRequestsQuery);

  const badge: Record<Queue, number | undefined> = {
    formularios: openRequests.data,
    cadastral: pendingProfile.data,
  };

  return (
    <div>
      <AdminPageHeader
        section="Gente & Gestão"
        title="Solicitações"
        description="Tudo que o time pediu pelo portal — formulários e atualizações de cadastro."
      />

      <div
        role="tablist"
        aria-label="Filas"
        className="mt-6 inline-flex flex-wrap gap-1 rounded-full border-[1.5px] border-ink bg-surface p-1"
      >
        {QUEUES.map((qq) => {
          const active = fila === qq.value;
          return (
            <button
              key={qq.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => navigate({ search: { fila: qq.value }, replace: true })}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors",
                active ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink",
              )}
            >
              {qq.label}
              {badge[qq.value] ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-black tabular-nums",
                    active ? "bg-accent text-ink" : "bg-ink/10 text-ink",
                  )}
                >
                  {badge[qq.value]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {fila === "formularios" ? <RequestQueue /> : <ProfileRequestQueue />}
      </div>
    </div>
  );
}
