import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/gente-gestao")({
  component: () => <Outlet />,
});

/**
 * Atalhos de Gente & Gestão. A chave `icon` é resolvida pelo `ICON_MAP`
 * (`src/lib/icon-map.ts`) — antes os ícones vinham de um array paralelo
 * indexado por posição, que quebrava a cada item inserido no meio.
 */
export const GG_LINKS = [
  {
    to: "/gente-gestao/holerite",
    title: "Holerite",
    desc: "Acesse seu contracheque",
    icon: "CreditCard",
  },
  {
    to: "/gente-gestao/beneficios",
    title: "Benefícios",
    desc: "Wellhub, Starbem e mais",
    icon: "Gift",
  },
  {
    to: "/gente-gestao/ferias",
    title: "Férias",
    desc: "Como programar as suas",
    icon: "Calendar",
  },
  {
    to: "/gente-gestao/atestados",
    title: "Atestados",
    desc: "Como lançar no ponto",
    icon: "FileText",
  },
  {
    to: "/gente-gestao/cadastro",
    title: "Atualização cadastral",
    desc: "Solicite alteração dos seus dados",
    icon: "UserCog",
  },
  {
    to: "/gente-gestao/politicas",
    title: "Políticas",
    desc: "Normas e diretrizes",
    icon: "BookOpen",
  },
  {
    to: "/gente-gestao/documentos",
    title: "Documentos",
    desc: "Arquivos e formulários",
    icon: "FolderOpen",
  },
  {
    to: "/gente-gestao/faq",
    title: "Dúvidas frequentes",
    desc: "Respostas rápidas",
    icon: "HelpCircle",
  },
  {
    to: "/gente-gestao/contatos",
    title: "Fale com G&G",
    desc: "Contatos da equipe",
    icon: "Users",
  },
] as const;
