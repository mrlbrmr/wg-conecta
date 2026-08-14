import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, backTo, action }: {
  eyebrow?: string; title: string; description?: string; backTo?: string; action?: ReactNode;
}) {
  return (
    <div className="mb-6 md:mb-8">
      {backTo && (
        <Link to={backTo as "/"} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && <span className="chip">{eyebrow}</span>}
          <h1 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="card-soft p-8 md:p-10 text-center">
      <p className="text-sm font-bold">{title}</p>
      {description && <p className="mt-1.5 text-xs text-muted-foreground max-w-md mx-auto">{description}</p>}
    </div>
  );
}
