/**
 * Recupera abas abertas quando entra um deploy novo.
 *
 * Os chunks são versionados por hash e o deploy anterior deixa de existir. Uma
 * aba que ficou aberta continua rodando o entry antigo e, ao navegar, pede um
 * chunk que já sumiu — o import dinâmico falha e o usuário cai no "Algo deu
 * errado", sem que nada esteja quebrado de fato. Recarregar busca o HTML novo e
 * resolve.
 *
 * O Vite emite `vite:preloadError` nesse caso; o `unhandledrejection` cobre os
 * imports dinâmicos que não passam pelo preload.
 */
const LAST_RELOAD_KEY = "wg-chunk-reload-at";

/**
 * Janela mínima entre recargas. Protege contra loop: se o chunk continuar
 * faltando logo depois de recarregar, a causa não é deploy novo e o erro
 * precisa aparecer em vez de virar ciclo. Deploys reais estão sempre a mais de
 * um minuto de distância um do outro.
 */
const MIN_INTERVAL_MS = 60_000;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function installStaleChunkRecovery() {
  if (typeof window === "undefined") return;

  const reloadOnce = () => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? 0);
    } catch {
      // sessionStorage indisponível (cookies bloqueados): sem como registrar a
      // tentativa, não recarrega — um loop seria pior que o erro visível.
      return;
    }
    if (Date.now() - last < MIN_INTERVAL_MS) return;
    try {
      sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
    } catch {
      return;
    }
    window.location.reload();
  };

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnce();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = String(
      (event.reason as { message?: string } | undefined)?.message ?? event.reason ?? "",
    );
    if (CHUNK_ERROR.test(message)) reloadOnce();
  });
}
