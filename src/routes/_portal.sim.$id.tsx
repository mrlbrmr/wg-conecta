import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { InkButton, PaperCard } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthorSubmissionCard } from "@/components/channel/submission-thread";
import { replyMySubmission } from "@/lib/channel.functions";
import { mySubmissionQuery, mySubmissionsQuery } from "@/lib/channel-queries";

/**
 * SIM enviado com o nome: quem enviou acompanha por aqui, sem protocolo e chave. O servidor só
 * devolve o envio se o autor for quem está logado — de outra pessoa cai em "não encontrado".
 */
export const Route = createFileRoute("/_portal/sim/$id")({
  head: () => ({ meta: [{ title: "Meu SIM — Portal WG" }] }),
  component: MySimPage,
});

function MySimPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const reply = useServerFn(replyMySubmission);
  const q = useQuery({ ...mySubmissionQuery(id), retry: false });

  const back = (
    <Link
      to="/perfil"
      search={{ aba: "solicitacoes" }}
      className="mb-6 inline-block text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground hover:text-ink"
    >
      ← Minhas solicitações
    </Link>
  );

  if (q.isLoading) return <Skeleton className="h-96 w-full" />;

  if (!q.data) {
    return (
      <div>
        {back}
        <PaperCard tone="soft" className="p-8">
          <p className="text-xl font-black tracking-tight">SIM não encontrado.</p>
          <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
            Ou ele não foi enviado com o seu nome, ou o link está velho. SIMs enviados sem
            identificação se acompanham pelo protocolo e pela chave.
          </p>
          <InkButton className="mt-5" asChild>
            <Link to="/acompanhar">Acompanhar pelo protocolo</Link>
          </InkButton>
        </PaperCard>
      </div>
    );
  }

  return (
    <div>
      {back}
      <AuthorSubmissionCard
        submission={q.data}
        onSend={async (body) => {
          await reply({ data: { id, body } });
          await qc.invalidateQueries({ queryKey: mySubmissionsQuery.queryKey });
        }}
      />
    </div>
  );
}
