import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { grade, STATUS_LABEL, STATUS_TONE, subjectTone } from "@/lib/format";
import { apiGet } from "@/lib/server";
import type { Enrollment, Paginated } from "@/lib/types";
import { CancelButton } from "./cancel-button";

export const metadata: Metadata = { title: "Mis materias" };

export default async function MyEnrollmentsPage() {
  const { data } = await apiGet<Paginated<Enrollment>>("/enrollments/mine?limit=100");

  // Agrupadas por periodo (el mas reciente primero)
  const byPeriod = new Map<string, { status: string; items: Enrollment[] }>();
  for (const e of data) {
    if (!byPeriod.has(e.period.code)) byPeriod.set(e.period.code, { status: e.period.status, items: [] });
    byPeriod.get(e.period.code)!.items.push(e);
  }
  const periods = [...byPeriod.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <>
      <PageHeader title="Mis materias" subtitle="Tus matrículas por periodo. Puedes cancelar mientras el periodo siga abierto." />

      {periods.length === 0 ? (
        <EmptyState title="Aún no tienes materias matriculadas" text="Ve a “Matricular” para inscribirte en los grupos disponibles." />
      ) : (
        <div className="space-y-8">
          {periods.map(([code, { status, items }]) => (
            <section key={code} aria-labelledby={`p-${code}`}>
              <div className="mb-3 flex items-center gap-3">
                <h2 id={`p-${code}`} className="text-lg font-bold">
                  Periodo {code}
                </h2>
                <Badge tone={status === "abierto" ? "success" : "neutral"}>{status === "abierto" ? "Abierto" : "Cerrado"}</Badge>
              </div>
              <ul className="grid gap-3">
                {items.map((e) => (
                  <li key={e._id}>
                    <Card className={cn("flex flex-wrap items-center gap-4 p-4 sm:p-5", e.status === "cancelada" && "opacity-60")}>
                      <span className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold", subjectTone(e.subject.code))}>{e.subject.code}</span>
                      <div className="min-w-48 flex-1">
                        <p className="font-bold">{e.subject.name}</p>
                        <p className="text-sm text-muted">
                          Grupo {e.group.number} · {e.subject.credits} créditos
                        </p>
                      </div>
                      {e.finalGrade !== undefined && (
                        <div className="text-right">
                          <p className="text-xs text-muted">Nota final</p>
                          <p className="text-xl font-extrabold">{grade(e.finalGrade)}</p>
                        </div>
                      )}
                      <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                      {e.status === "activa" && status === "abierto" && <CancelButton id={e._id} name={e.subject.name} />}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
