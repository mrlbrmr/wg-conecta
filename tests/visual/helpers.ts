import { expect, type Page } from "@playwright/test";

/**
 * Helpers para checks de layout — detectam quebras e desalinhamentos
 * sem depender de pixel-diff.
 */

/** Página não pode ter scroll horizontal (indica conteúdo estourando o viewport). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      diff: doc.scrollWidth - doc.clientWidth,
    };
  });
  expect(
    overflow.diff,
    `Overflow horizontal detectado: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(1);
}

/**
 * Nenhum elemento de texto visível pode transbordar o próprio container
 * (indica truncamento não intencional ou quebra torta).
 * Tolera pequenos elementos com overflow explicitamente controlado (line-clamp/ellipsis).
 */
export async function expectNoTextOverflow(page: Page) {
  const offenders = await page.evaluate(() => {
    const bad: Array<{ tag: string; text: string; overflowX: number; overflowY: number }> = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, p, span, a, button, li, dt, dd",
    );
    nodes.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      // pula elementos que declaram truncamento intencional
      if (
        style.textOverflow === "ellipsis" ||
        style.overflow === "hidden" ||
        style.overflowX === "hidden" ||
        el.className.includes("line-clamp") ||
        el.className.includes("truncate") ||
        el.className.includes("sr-only")
      )
        return;
      const overflowX = el.scrollWidth - el.clientWidth;
      const overflowY = el.scrollHeight - el.clientHeight;
      // toleramos 2px por causa de arredondamento de sub-pixel
      if (overflowX > 2 || overflowY > 2) {
        bad.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 60),
          overflowX,
          overflowY,
        });
      }
    });
    return bad;
  });
  expect(
    offenders,
    `Elementos com texto transbordando:\n${offenders
      .map((o) => `  <${o.tag}> "${o.text}" overflowX=${o.overflowX} overflowY=${o.overflowY}`)
      .join("\n")}`,
  ).toEqual([]);
}

/** Toda página deve ter exatamente 1 h1 (hierarquia editorial correta). */
export async function expectSingleH1(page: Page) {
  const count = await page.locator("h1").count();
  expect(count, "Deve haver exatamente 1 <h1> na página").toBe(1);
}

/**
 * Elementos com whitespace-nowrap não podem exceder o viewport
 * (evita headers/navs "tortos" em mobile).
 */
export async function expectNowrapFitsViewport(page: Page) {
  const offenders = await page.evaluate(() => {
    const vw = window.innerWidth;
    const bad: Array<{ text: string; width: number }> = [];
    document.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.whiteSpace !== "nowrap") return;
      if (el.offsetParent === null) return;
      if (el.scrollWidth > vw + 1) {
        bad.push({
          text: (el.textContent || "").trim().slice(0, 60),
          width: el.scrollWidth,
        });
      }
    });
    return bad;
  });
  expect(
    offenders,
    `Elementos nowrap maiores que viewport:\n${offenders
      .map((o) => `  "${o.text}" width=${o.width}`)
      .join("\n")}`,
  ).toEqual([]);
}

/** Bateria completa de checks visuais para uma rota já carregada. */
export async function runLayoutChecks(page: Page) {
  // dá tempo para fontes carregarem antes de medir
  await page.evaluate(() => document.fonts?.ready);
  await expectNoHorizontalOverflow(page);
  await expectNowrapFitsViewport(page);
  await expectNoTextOverflow(page);
}
