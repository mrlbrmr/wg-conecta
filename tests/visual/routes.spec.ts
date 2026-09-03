import { test, expect } from "@playwright/test";
import { runLayoutChecks, expectSingleH1 } from "./helpers";

/**
 * Rotas públicas principais do portal.
 * Cobrem o mural editorial da home, nav, listagens e páginas de conteúdo.
 */
const PUBLIC_ROUTES = [
  { path: "/", name: "home / mural bento" },
  { path: "/comunicados", name: "comunicados" },
  { path: "/vagas", name: "vagas" },
  { path: "/gente-gestao", name: "gente & gestão" },
  { path: "/cultura", name: "cultura" },
  { path: "/formularios", name: "formulários" },
  { path: "/formularios/ferias", name: "formulário de férias" },
  { path: "/formularios/atualizacao-cadastral", name: "atualização cadastral" },
  { path: "/formularios/solicitacao-geral", name: "solicitação geral G&G" },
  { path: "/formularios/enviado?protocolo=1001", name: "confirmação de envio" },
  { path: "/integracao", name: "integração" },
];

for (const route of PUBLIC_ROUTES) {
  test(`layout OK — ${route.name} (${route.path})`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "networkidle" });
    await runLayoutChecks(page);
  });
}

test("layout OK — home tem h1 único", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expectSingleH1(page);
});

test("layout OK — detalhe de comunicado", async ({ page }) => {
  await page.goto("/comunicados", { waitUntil: "networkidle" });
  // pega o primeiro link para /comunicados/<id>
  const detailLink = page
    .locator('a[href^="/comunicados/"]')
    .filter({ hasNot: page.locator('a[href="/comunicados/arquivo"]') })
    .first();
  const count = await detailLink.count();
  test.skip(count === 0, "Nenhum comunicado disponível para testar detalhe");
  const href = await detailLink.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!, { waitUntil: "networkidle" });
  await runLayoutChecks(page);
  await expectSingleH1(page);
});
