import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, PageHeader } from "@/components/ui/feedback";
import { WeekSchedule } from "@/components/week-schedule";
import { plural } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/server";
import type { StudentSchedule } from "@/lib/types";

export const metadata: Metadata = { title: "Horario" };

export default async function SchedulePage() {
  let schedule: StudentSchedule | null = null;
  try {
    schedule = await apiGet<StudentSchedule>("/students/me/schedule");
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status !== 404) {
      return <><PageHeader title="Mi horario" /><Alert>{error.message}</Alert></>;
    }
  }

  if (!schedule) {
    return (
      <>
        <PageHeader title="Mi horario" />
        <EmptyState title="No hay un periodo abierto" text="Cuando haya un periodo abierto verás aquí tus clases de la semana." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mi horario"
        subtitle={`Periodo ${schedule.period.code}`}
        action={
          <div className="flex gap-2">
            <Badge tone="primary">{plural(schedule.subjects, "materia", "materias")}</Badge>
            <Badge tone="primary">{plural(schedule.credits, "crédito", "créditos")}</Badge>
          </div>
        }
      />

      {schedule.slots.length === 0 ? (
        <EmptyState title="Aún no tienes clases" text="Matricula materias para ver tu horario semanal." />
      ) : (
        <WeekSchedule byDay={schedule.byDay} />
      )}
    </>
  );
}
