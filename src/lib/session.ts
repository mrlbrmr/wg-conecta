import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Prefixo de tudo que o Baterito guarda no navegador. */
export const BATERITO_STORE_PREFIX = "wg-baterito";

/**
 * Apaga o que o portal guardou no navegador em nome de alguém: a conversa do
 * Baterito (hoje em `sessionStorage`, antes em `localStorage`) e o badge.
 */
export function clearLocalUserData() {
  for (const store of [safeStorage("local"), safeStorage("session")]) {
    if (!store) continue;
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(`${BATERITO_STORE_PREFIX}:`)) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  }
}

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Sai da conta. A limpeza do cache e do navegador fica com `useAuthIsolation`. */
export async function signOut() {
  await supabase.auth.signOut();
  // Garante a limpeza mesmo se o evento SIGNED_OUT não chegar (rede caída).
  clearLocalUserData();
}

/**
 * Isolamento entre contas no mesmo navegador.
 *
 * O cache do React Query usa chaves "own" sem o id de quem está logado, e o
 * layout do portal não desmonta ao trocar de conta. Sem isso, quem entra
 * depois via por alguns instantes o perfil, as solicitações e o avatar de quem
 * saiu. Quando o usuário muda — logout, login por cima ou login em outra aba (o
 * supabase-js sincroniza as abas) —, o cache é descartado e as rotas refazem o
 * `beforeLoad`, que redireciona para o login se não houver ninguém.
 */
export function useAuthIsolation(queryClient: QueryClient) {
  const router = useRouter();
  /** `undefined` = ainda não sabemos quem é; `null` = ninguém logado. */
  const currentUser = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null;
      const previous = currentUser.current;
      currentUser.current = next;
      if (previous === undefined || previous === next) return;

      queryClient.clear();
      clearLocalUserData();
      void router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);
}
