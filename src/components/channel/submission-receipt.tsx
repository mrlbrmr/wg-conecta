import { Link } from "@tanstack/react-router";
import { Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { InkButton, Kicker, PaperCard } from "@/components/paper";
import { CHANNEL_META, type Channel } from "@/lib/channel-defs";

/**
 * Comprovante do envio.
 * - Sem identificação: protocolo + chave, que só quem enviou recebe. Não há como recuperar a
 *   chave depois — o banco guarda só o hash dela.
 * - Identificado: só o protocolo; o acompanhamento fica no Perfil.
 */
export function SubmissionReceipt({
  channel,
  protocol,
  accessKey,
  id,
  onAnother,
}: {
  channel: Channel;
  protocol: string;
  accessKey: string | null;
  id: string | null;
  onAnother: () => void;
}) {
  const meta = CHANNEL_META[channel];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Protocolo: ${protocol}\nChave: ${accessKey}`);
      toast.success("Protocolo e chave copiados.");
    } catch {
      toast.error("Não deu para copiar. Anote os dois.");
    }
  };

  return (
    <PaperCard className="p-6 md:p-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <Kicker>Recebido</Kicker>
      </div>
      <h2 className="mt-3 text-[26px] font-black leading-tight tracking-[-0.03em]">
        {meta.received}
      </h2>

      {accessKey ? (
        <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.65] text-muted-foreground">
          Guarde o protocolo e a chave abaixo. São eles que mostram a resposta do G&amp;G e deixam
          você conversar sem se identificar. <strong>A chave não aparece de novo</strong> e ninguém
          consegue recuperá-la — nem o G&amp;G.
        </p>
      ) : (
        <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.65] text-muted-foreground">
          Você acompanha a resposta em Meu perfil › Solicitações. Quando o G&amp;G responder, avisamos
          no seu e-mail.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <PaperCard tone="accent" className="p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]">Protocolo</p>
          <p className="mt-1.5 select-all font-mono text-[26px] font-black tracking-[0.04em]">
            {protocol}
          </p>
        </PaperCard>
        {accessKey && (
          <PaperCard tone="accent" className="p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]">Chave</p>
            <p className="mt-1.5 select-all font-mono text-[26px] font-black tracking-[0.04em]">
              {accessKey}
            </p>
          </PaperCard>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        {accessKey ? (
          <>
            <InkButton onClick={copy}>
              <Copy className="h-4 w-4" /> Copiar os dois
            </InkButton>
            <InkButton variant="outline" asChild>
              <Link to="/acompanhar">Acompanhar</Link>
            </InkButton>
          </>
        ) : (
          id && (
            <InkButton asChild>
              <Link to="/sim/$id" params={{ id }}>
                Ver meu SIM
              </Link>
            </InkButton>
          )
        )}
        <InkButton variant="outline" onClick={onAnother}>
          Enviar outro
        </InkButton>
      </div>
      {accessKey && (
        <p className="mt-4 text-xs leading-[1.6] text-muted-foreground">
          Dica: tire um print desta tela ou anote num lugar só seu. Em computador compartilhado, não
          salve no navegador.
        </p>
      )}
    </PaperCard>
  );
}
