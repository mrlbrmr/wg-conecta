import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ProfileRequestQueue } from "@/components/admin/profile-request-queue";
import { RequestQueue } from "@/components/admin/request-queue";
import { pendingProfileRequestsQuery } from "@/lib/admin-queries";
import { openRequestsQuery } from "@/lib/admin-queries";

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
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F2E9] -m-6 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-black">Solicitações</h1>
        <p className="text-sm text-gray-700">
          Tudo que o time pediu pelo portal — formulários e atualizações de cadastro.
        </p>
      </div>

      <div className="mb-5 inline-flex items-center gap-1 rounded-lg border-2 border-black bg-white p-1">
        {QUEUES.map((qq) => {
          const active = fila === qq.value;
          return (
            <button
              key={qq.value}
              onClick={() => navigate({ search: { fila: qq.value }, replace: true })}
              className={`rounded px-4 py-1.5 text-sm transition-all ${
                active ? "bg-black text-white font-bold" : "text-gray-700 hover:text-black"
              }`}
            >
              {qq.label}
              {badge[qq.value] ? (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    active ? "bg-[#8FD152] text-black" : "bg-black/10 text-black"
                  }`}
                >
                  {badge[qq.value]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {fila === "formularios" ? <RequestQueue /> : <ProfileRequestQueue />}
    </div>
  );
}
