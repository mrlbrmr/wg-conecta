import type { LucideIcon } from "lucide-react";
import {
  Megaphone, Gift, FileText, HelpCircle, Briefcase, Sparkles,
  ClipboardList, Cake, Award, PartyPopper, Users, Link2, ScrollText, Building2, UserCheck,
} from "lucide-react";

export type FieldType = "text" | "textarea" | "number" | "boolean" | "select" | "date" | "url" | "email" | "file" | "image" | "tags" | "richtext" | "icon";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface ResourceDef {
  key: string;
  label: string;
  labelSingular: string;
  icon: LucideIcon;
  table: string;
  orderBy?: { column: string; ascending?: boolean };
  displayColumns: { key: string; label: string }[];
  fields: FieldDef[];
  section?: string;
}

export const RESOURCES: ResourceDef[] = [
  {
    key: "comunicados", label: "Comunicados", labelSingular: "Comunicado", icon: Megaphone, table: "announcements",
    orderBy: { column: "published_at", ascending: false }, section: "Comunicação",
    displayColumns: [{ key: "title", label: "Título" }, { key: "status", label: "Status" }, { key: "category", label: "Categoria" }, { key: "published_at", label: "Publicado" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "summary", label: "Resumo", type: "textarea" },
      { key: "content", label: "Texto completo", type: "richtext" },
      { key: "image_url", label: "Imagem", type: "image" },
      { key: "attachment_url", label: "Anexo", type: "file" },
      { key: "category", label: "Categoria", type: "text" },
      { key: "tags", label: "Tags", type: "tags" },
      { key: "published_at", label: "Publicado em", type: "date" },
      { key: "expires_at", label: "Válido até", type: "date" },
      { key: "status", label: "Status", type: "select", required: true,
        options: [{ value: "rascunho", label: "Rascunho" }, { value: "publicado", label: "Publicado" }, { value: "arquivado", label: "Arquivado" }] },
      { key: "pinned", label: "Fixar na home", type: "boolean" },
      { key: "important", label: "Comunicado importante", type: "boolean" },
    ],
  },
  {
    key: "links-rapidos", label: "Links rápidos", labelSingular: "Link", icon: Link2, table: "quick_links",
    orderBy: { column: "order_index" }, section: "Home",
    displayColumns: [{ key: "title", label: "Título" }, { key: "url", label: "URL" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "description", label: "Descrição", type: "text" },
      { key: "icon", label: "Ícone", type: "icon" },
      { key: "url", label: "URL", type: "text", required: true },
      { key: "category", label: "Categoria", type: "text" },
      { key: "order_index", label: "Ordem", type: "number" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "beneficios", label: "Benefícios", labelSingular: "Benefício", icon: Gift, table: "benefits",
    orderBy: { column: "order_index" }, section: "Gente & Gestão",
    displayColumns: [{ key: "title", label: "Título" }, { key: "active", label: "Ativo" }, { key: "order_index", label: "Ordem" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "eligibility", label: "Elegibilidade", type: "text" },
      { key: "observation", label: "Observação", type: "text" },
      { key: "external_url", label: "Link externo", type: "url" },
      { key: "attachment_url", label: "Anexo", type: "file" },
      { key: "image_url", label: "Imagem", type: "image" },
      { key: "icon", label: "Ícone", type: "icon" },
      { key: "order_index", label: "Ordem", type: "number" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "documentos", label: "Documentos", labelSingular: "Documento", icon: FileText, table: "documents",
    orderBy: { column: "published_at", ascending: false }, section: "Gente & Gestão",
    displayColumns: [{ key: "title", label: "Título" }, { key: "category", label: "Categoria" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "category", label: "Categoria", type: "text" },
      { key: "file_url", label: "Arquivo", type: "file", required: true },
      { key: "tags", label: "Tags", type: "tags" },
      { key: "featured", label: "Destaque", type: "boolean" },
      { key: "active", label: "Ativo", type: "boolean" },
      { key: "published_at", label: "Publicado em", type: "date" },
    ],
  },
  {
    key: "faq", label: "Dúvidas Frequentes", labelSingular: "Dúvida", icon: HelpCircle, table: "faq_items",
    orderBy: { column: "order_index" }, section: "Gente & Gestão",
    displayColumns: [{ key: "question", label: "Pergunta" }, { key: "category", label: "Categoria" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "question", label: "Pergunta", type: "text", required: true },
      { key: "answer", label: "Resposta", type: "richtext", required: true },
      { key: "category", label: "Categoria", type: "text" },
      { key: "tags", label: "Tags", type: "tags" },
      { key: "order_index", label: "Ordem", type: "number" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "vagas", label: "Vagas internas", labelSingular: "Vaga", icon: Briefcase, table: "internal_jobs",
    orderBy: { column: "published_at", ascending: false }, section: "Oportunidades",
    displayColumns: [{ key: "title", label: "Título" }, { key: "status", label: "Status" }, { key: "location", label: "Local" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "location", label: "Unidade/Local", type: "text" },
      { key: "job_type", label: "Tipo", type: "text" },
      { key: "summary", label: "Resumo", type: "textarea" },
      { key: "requirements", label: "Requisitos", type: "textarea" },
      { key: "external_url", label: "Link (Portal de Carreiras)", type: "url" },
      { key: "status", label: "Status", type: "select", options: [
        { value: "aberta", label: "Aberta" }, { value: "pausada", label: "Pausada" }, { value: "encerrada", label: "Encerrada" }] },
      { key: "published_at", label: "Publicado em", type: "date" },
      { key: "order_index", label: "Ordem", type: "number" },
    ],
  },
  {
    key: "integracao", label: "Integração", labelSingular: "Material", icon: Sparkles, table: "onboarding_materials",
    orderBy: { column: "order_index" }, section: "Integração",
    displayColumns: [{ key: "title", label: "Título" }, { key: "category", label: "Categoria" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "description", label: "Descrição", type: "text" },
      { key: "content", label: "Conteúdo", type: "richtext" },
      { key: "image_url", label: "Imagem", type: "image" },
      { key: "attachment_url", label: "Anexo", type: "file" },
      { key: "external_url", label: "Link externo", type: "url" },
      { key: "category", label: "Categoria", type: "text" },
      { key: "order_index", label: "Ordem", type: "number" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "formularios", label: "Formulários", labelSingular: "Formulário", icon: ClipboardList, table: "forms",
    orderBy: { column: "order_index" }, section: "Portal",
    displayColumns: [{ key: "title", label: "Título" }, { key: "category", label: "Categoria" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "title", label: "Nome", type: "text", required: true },
      { key: "description", label: "Descrição", type: "text" },
      { key: "category", label: "Categoria", type: "text" },
      { key: "external_url", label: "Link externo", type: "url", required: true },
      { key: "icon", label: "Ícone", type: "icon" },
      { key: "order_index", label: "Ordem", type: "number" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "aniversariantes", label: "Aniversariantes", labelSingular: "Aniversariante", icon: Cake, table: "birthdays",
    orderBy: { column: "birthday_month" }, section: "Cultura",
    displayColumns: [{ key: "name", label: "Nome" }, { key: "birthday_day", label: "Dia" }, { key: "birthday_month", label: "Mês" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "name", label: "Nome", type: "text", required: true },
      { key: "role", label: "Cargo", type: "text" },
      { key: "unit", label: "Unidade", type: "text" },
      { key: "birthday_day", label: "Dia do aniversário", type: "number", required: true },
      { key: "birthday_month", label: "Mês (1-12)", type: "number", required: true },
      { key: "photo_url", label: "Foto", type: "image" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "tempo-de-casa", label: "Tempo de casa", labelSingular: "Aniversário de casa", icon: PartyPopper, table: "work_anniversaries",
    orderBy: { column: "admission_date" }, section: "Cultura",
    displayColumns: [{ key: "name", label: "Nome" }, { key: "admission_date", label: "Admissão" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "name", label: "Nome", type: "text", required: true },
      { key: "role", label: "Cargo", type: "text" },
      { key: "unit", label: "Unidade", type: "text" },
      { key: "admission_date", label: "Data de admissão", type: "date", required: true },
      { key: "photo_url", label: "Foto", type: "image" },
      { key: "message", label: "Mensagem", type: "text" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "reconhecimentos", label: "Reconhecimentos", labelSingular: "Reconhecimento", icon: Award, table: "recognitions",
    orderBy: { column: "recognition_date", ascending: false }, section: "Cultura",
    displayColumns: [{ key: "title", label: "Título" }, { key: "person_or_team", label: "Pessoa/Equipe" }, { key: "recognition_date", label: "Data" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "person_or_team", label: "Colaborador ou equipe", type: "text", required: true },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "image_url", label: "Foto", type: "image" },
      { key: "recognition_date", label: "Data", type: "date" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "campanhas", label: "Campanhas", labelSingular: "Campanha", icon: Sparkles, table: "campaigns",
    orderBy: { column: "created_at", ascending: false }, section: "Cultura",
    displayColumns: [{ key: "title", label: "Título" }, { key: "start_date", label: "Início" }, { key: "end_date", label: "Fim" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "description", label: "Descrição", type: "textarea" },
      { key: "image_url", label: "Imagem", type: "image" },
      { key: "start_date", label: "Início", type: "date" },
      { key: "end_date", label: "Fim", type: "date" },
      { key: "external_url", label: "Link", type: "url" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "contatos", label: "Contatos G&G", labelSingular: "Contato", icon: Users, table: "contacts",
    orderBy: { column: "order_index" }, section: "Gente & Gestão",
    displayColumns: [{ key: "name", label: "Nome" }, { key: "area", label: "Área" }, { key: "email", label: "E-mail" }],
    fields: [
      { key: "name", label: "Nome", type: "text", required: true },
      { key: "area", label: "Área", type: "text" },
      { key: "description", label: "Descrição", type: "text" },
      { key: "email", label: "E-mail", type: "email" },
      { key: "phone", label: "Telefone", type: "text" },
      { key: "photo_url", label: "Foto", type: "image" },
      { key: "order_index", label: "Ordem", type: "number" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
  {
    key: "paginas-gg", label: "Páginas G&G", labelSingular: "Página", icon: ScrollText, table: "gg_pages",
    section: "Gente & Gestão",
    displayColumns: [{ key: "page_key", label: "Chave" }, { key: "title", label: "Título" }, { key: "active", label: "Ativo" }],
    fields: [
      { key: "page_key", label: "Chave (ferias, atestados, cadastro, holerite, politicas)", type: "text", required: true },
      { key: "title", label: "Título", type: "text", required: true },
      { key: "body", label: "Conteúdo", type: "richtext" },
      { key: "attachment_url", label: "Anexo", type: "file" },
      { key: "external_url", label: "Link externo", type: "url" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
  },
];

export function findResource(key: string) { return RESOURCES.find(r => r.key === key); }
export const SIDEBAR_EXTRA = [
  { key: "colaboradores", label: "Colaboradores", icon: UserCheck, section: "Configurações" },
  { key: "usuarios", label: "Usuários admin", icon: Users, section: "Configurações" },
  { key: "configuracoes", label: "Configurações gerais", icon: Building2, section: "Configurações" },
];
