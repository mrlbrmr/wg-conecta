import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/gente-gestao")({
  component: () => <Outlet />,
});

// Re-export navigation link list for the hub page usage
export const GG_LINKS = [
  { to: "/gente-gestao/beneficios", title: "Benefícios", desc: "Wellhub, Starbem e mais" },
  { to: "/gente-gestao/documentos", title: "Documentos", desc: "Políticas e arquivos" },
  { to: "/gente-gestao/faq", title: "Dúvidas Frequentes", desc: "Respostas rápidas" },
  { to: "/gente-gestao/ferias", title: "Solicitação de Férias", desc: "Como pedir suas férias" },
  { to: "/gente-gestao/atestados", title: "Atestados", desc: "Como lançar no ponto" },
  { to: "/gente-gestao/holerite", title: "Holerite", desc: "Acesse seu contracheque" },
  { to: "/gente-gestao/politicas", title: "Políticas Internas", desc: "Normas e diretrizes" },
  { to: "/gente-gestao/contatos", title: "Fale com G&G", desc: "Contatos da equipe" },
] as const;

export const _linkForHub = Link; // silence unused import if any
