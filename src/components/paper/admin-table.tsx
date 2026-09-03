import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AdminColumn<T> {
  key: string;
  label: string;
  /** Trilha do grid CSS: `1fr`, `150px`, `210px`… */
  width: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

export interface AdminTableProps<T> {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Título do estado vazio — muda quando há filtro aplicado. */
  emptyTitle?: string;
  emptyHint?: string;
  /** Regra da seção, exibida abaixo da tabela. */
  note?: ReactNode;
  className?: string;
}

/** Tabela do painel: cabeçalho em tinta, linhas de duas alturas, ações à direita. */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "Nenhum registro nesta seção ainda.",
  emptyHint = "Crie o primeiro registro — ele aparece no portal assim que for publicado.",
  note,
  className,
}: AdminTableProps<T>) {
  const template = columns.map((c) => c.width).join(" ");

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-lg border-[1.5px] border-ink bg-surface shadow-paper">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div
              className="grid items-center gap-4 bg-ink px-[22px] py-[13px]"
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((c) => (
                <div
                  key={c.key}
                  className={cn(
                    "text-[10px] font-extrabold uppercase tracking-[0.16em] text-paper/75",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.label}
                </div>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="px-[22px] py-10">
                <p className="text-xl font-black tracking-tight">{emptyTitle}</p>
                <p className="mt-2 text-sm text-muted-foreground">{emptyHint}</p>
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={rowKey(row)}
                  className="grid items-center gap-4 border-t border-border px-[22px] py-4"
                  style={{ gridTemplateColumns: template }}
                >
                  {columns.map((c) => (
                    <div key={c.key} className={cn("min-w-0", c.align === "right" && "text-right")}>
                      {c.render(row)}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {note && <p className="mt-4 text-[13px] leading-[1.6] text-muted-foreground">{note}</p>}
    </div>
  );
}
