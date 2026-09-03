import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { userIdFromRequest } from "@/lib/route-auth";
import { searchKnowledge, sourcesOf } from "@/lib/baterito/knowledge.server";
import {
  buildContext,
  HANDOFF_ANSWER,
  MODEL_DOWN_ANSWER,
  SYSTEM_PROMPT,
} from "@/lib/baterito/prompt";
import { hasPII, maskPII } from "@/lib/baterito/pii";
import { bateritoDb } from "@/lib/baterito/db.server";
import type { BateritoSource } from "@/lib/baterito/types";

/**
 * Modelo pela string do AI Gateway. Trocar por um mais barato (por exemplo
 * `anthropic/claude-haiku-4.5`) é mudar esta linha — o Gateway resolve o
 * provedor e cobra o preço de lista dele, sem markup.
 */
const MODEL = "anthropic/claude-sonnet-5";

/** 30 mensagens por hora por colaborador, como sugere o handoff. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** Só as últimas trocas viram contexto: o resto é ruído e token pago. */
const HISTORY_TURNS = 6;

const PII_ANSWER =
  "Opa — aqui não rola mandar CPF, telefone, endereço ou dado bancário, nem pra mim.\nApaga essa parte e pergunta de novo que eu respondo numa boa.";

const RATE_ANSWER =
  "Você mandou muita pergunta em pouco tempo e eu preciso respirar.\nTenta de novo daqui a pouco — se for urgente, fala direto com o G&G.";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["bot", "user"]), text: z.string().max(4000) }))
    .max(40)
    .optional(),
});

export const Route = createFileRoute("/api/baterito")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await userIdFromRequest(request);
        if (!userId) return json({ error: "unauthorized" }, 401);

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "bad_request" }, 400);
        const { message, history = [] } = parsed.data;

        const db = await bateritoDb();

        // Freio antes de qualquer coisa cara: nada de busca nem de modelo.
        const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
        const { count } = await db
          .from("baterito_queries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", since);
        if ((count ?? 0) >= RATE_LIMIT) {
          return streamCanned(RATE_ANSWER, []);
        }

        const masked = maskPII(message);

        // PII na pergunta não vai para o modelo nem para o banco em claro.
        if (hasPII(message)) {
          await log(db, userId, masked, false, []);
          return streamCanned(PII_ANSWER, []);
        }

        const hits = await searchKnowledge(masked);

        // Sem base, sem palpite: encaminha e registra a lacuna para o G&G.
        if (hits.length === 0) {
          await log(db, userId, masked, false, []);
          return streamCanned(HANDOFF_ANSWER, []);
        }

        const sources = sourcesOf(hits);
        const { streamText } = await import("ai");

        const result = streamText({
          model: MODEL,
          system: SYSTEM_PROMPT,
          messages: [
            ...history.slice(-HISTORY_TURNS).map((m) => ({
              role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
              content: m.text,
            })),
            { role: "user" as const, content: `${buildContext(hits)}\n\nPergunta: ${masked}` },
          ],
          onError: ({ error }) => console.error("[baterito] streamText", error),
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let full = "";
            try {
              for await (const delta of result.textStream) {
                full += delta;
                controller.enqueue(encoder.encode(sse({ type: "text", value: delta })));
              }
            } catch (err) {
              console.error("[baterito] stream", err);
            }

            // Sem texto nenhum: modelo fora do ar, chave ausente, crédito
            // acabado. A base TINHA material, então a falha é do assistente e o
            // texto precisa dizer isso — mandar o encaminhamento aqui viraria
            // lacuna de conteúdo falsa no relatório do G&G. Por isso também
            // não registra: não é lacuna nem resposta. O preço é o rate limit
            // não contar enquanto o modelo está fora — e aí não há custo de IA
            // para conter mesmo.
            if (!full.trim()) {
              console.error("[baterito] modelo não devolveu texto");
              controller.enqueue(encoder.encode(sse({ type: "text", value: MODEL_DOWN_ANSWER })));
              controller.enqueue(encoder.encode(sse({ type: "done", sources: [] })));
              controller.close();
              return;
            }

            controller.enqueue(encoder.encode(sse({ type: "done", sources })));
            controller.close();
            await log(
              db,
              userId,
              masked,
              true,
              sources.map((s) => s.title),
            );
          },
        });

        return new Response(stream, { headers: SSE_HEADERS });
      },
    },
  },
});

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function sse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Resposta pronta no mesmo formato do stream do modelo — assim o cliente tem um
 * caminho só para renderizar, venha o texto do modelo ou daqui.
 */
function streamCanned(text: string, sources: BateritoSource[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sse({ type: "text", value: text })));
      controller.enqueue(encoder.encode(sse({ type: "done", sources })));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/** Registro para o rate limit e para a lista de lacunas de conteúdo do G&G. */
async function log(
  supabase: Awaited<ReturnType<typeof bateritoDb>>,
  userId: string,
  question: string,
  answered: boolean,
  sources: string[],
) {
  const { error } = await supabase
    .from("baterito_queries")
    .insert({ user_id: userId, question, answered, sources });
  if (error) console.error("[baterito] log", error.message);
}
