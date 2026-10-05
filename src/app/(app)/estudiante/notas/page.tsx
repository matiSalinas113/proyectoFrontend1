import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { grade, STATUS_LABEL, STATUS_TONE, subjectTone } from "@/lib/format";
import { apiGet } from "@/lib/server";
import type { Enrollment, Evaluation, MyGrade, Paginated } from "@/lib/types";

export const metadata: Metadata = { title: "Notas" };

const PASSING = 3.0;

export default async function GradesPage() {
  const [enrollments, grades] = await Promise.all([
    apiGet<Paginated<Enrollment>>("/enrollments/mine?limit=100"),
    apiGet<Paginated<MyGrade>>("/grades/mine?limit=100"),
  ]);

  // Mas recientes primero; las canceladas no tienen notas que mostrar
  const courses = enrollments.data.filter((e) => e.status !== "cancelada").sort((a, b) => b.period.code.localeCompare(a.period.code));

  // Plan de evaluacion de cada grupo (para mostrar tambien lo que aun no tiene nota)
  const plans = await Promise.all(courses.map((e) => apiGet<Paginated<Evaluation>>(`/evaluations?group=${e.group._id}&limit=100`)));

  const myGrades = new Map(grades.data.map((g) => [`${g.enrollment._id}:${g.evaluation._id}`, g.value]));

  return (
    <>
      <PageHeader title="Mis notas" subtitle="Escala de 0.0 a 5.0. Se aprueba con 3.0 o más." />

      {courses.length === 0 ? (
        <EmptyState title="Aún no tienes notas" text="Cuando tus docentes registren evaluaciones, las verás aquí." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {courses.map((e, i) => {
            const evaluations = plans[i].data;
            const rows = evaluations.map((ev) => ({ ev, value: myGrades.get(`${e._id}:${ev._id}`) }));
            const graded = rows.filter((r) => r.value !== undefined);
            const points = graded.reduce((sum, r) => sum + (r.value ?? 0) * r.ev.weight / 100, 0);
            const evaluated = rows.reduce((sum, r) => sum + (r.value !== undefined ? r.ev.weight : 0), 0);

            return (
              <Card key={e._id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={cn("inline-block rounded-lg border px-2 py-0.5 text-xs font-bold", subjectTone(e.subject.code))}>{e.subject.code}</span>
                    <h2 className="mt-2 text-lg leading-snug font-bold">{e.subject.name}</h2>
                    <p className="text-sm text-muted">
                      {e.period.code} · Grupo {e.group.number}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                </div>

                {rows.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">El docente aún no define las evaluaciones de este grupo.</p>
                ) : (
                  <table className="mt-4 w-full text-sm">
                    <caption className="sr-only">Notas de {e.subject.name}</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th scope="col" className="pb-2 font-semibold">Evaluación</th>
                        <th scope="col" className="pb-2 text-right font-semibold">Peso</th>
                        <th scope="col" className="pb-2 text-right font-semibold">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ ev, value }) => (
                        <tr key={ev._id} className="border-b border-line/60 last:border-0">
                          <td className="py-2.5 font-medium">{ev.name}</td>
                          <td className="py-2.5 text-right text-muted">{ev.weight}%</td>
                          <td className={cn("py-2.5 text-right font-bold", value === undefined ? "text-muted" : value < PASSING ? "text-danger-600" : "text-success-600")}>
                            {value === undefined ? "Pendiente" : grade(value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mt-4 flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
                  {e.finalGrade !== undefined ? (
                    <>
                      <span className="text-sm font-semibold">Nota final</span>
                      <span className={cn("text-2xl font-extrabold", e.finalGrade < PASSING ? "text-danger-600" : "text-success-600")}>{grade(e.finalGrade)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-muted">
                        Acumulado ({evaluated}% evaluado)
                      </span>
                      <span className="text-xl font-extrabold">{evaluated > 0 ? points.toFixed(2) : "—"}</span>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
