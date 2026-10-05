import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock, DoorOpen, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { DAY_SHORT, subjectTone } from "@/lib/format";
import { apiGet, apiGetOrNull } from "@/lib/server";
import type { Paginated, Period, TeacherGroup } from "@/lib/types";
import { PeriodSelect } from "./period-select";

export const metadata: Metadata = { title: "Mis grupos" };

export default async function MyGroupsPage({ searchParams }: PageProps<"/docente/grupos">) {
  const { period: requested } = await searchParams;
  const [current, periods] = await Promise.all([apiGetOrNull<Period>("/periods/current"), apiGet<Paginated<Period>>("/periods?limit=100")]);

  // Por defecto el periodo abierto; "todos" lista todos los periodos
  const selected = typeof requested === "string" ? requested : (current?._id ?? "");
  const groups = await apiGet<Paginated<TeacherGroup>>(`/groups/mine?limit=100${selected && selected !== "todos" ? `&period=${selected}` : ""}`);

  return (
    <>
      <PageHeader
        title="Mis grupos"
        subtitle="Entra a un grupo para ver sus estudiantes, definir evaluaciones y registrar notas."
        action={<PeriodSelect periods={periods.data.map((p) => ({ id: p._id, label: `${p.code}${p.status === "abierto" ? " (abierto)" : ""}` }))} value={selected || "todos"} />}
      />

      {groups.data.length === 0 ? (
        <EmptyState title="No tienes grupos en este periodo" text="Prueba con otro periodo o con “Todos los periodos”." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {groups.data.map((g) => (
            <li key={g._id}>
              <Link href={`/docente/grupos/${g._id}`} className="group block rounded-(--radius-card) focus-visible:outline-offset-4">
                <Card className="h-full p-5 transition-shadow group-hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={cn("inline-block rounded-lg border px-2 py-0.5 text-xs font-bold", subjectTone(g.subject.code))}>{g.subject.code}</span>
                      <h2 className="mt-2 text-lg leading-snug font-bold">{g.subject.name}</h2>
                      <p className="text-sm text-muted">
                        Grupo {g.number} · Periodo {g.period.code}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone="primary">
                      <Users className="mr-1 size-3" aria-hidden />
                      {g.enrolled} / {g.capacity} estudiantes
                    </Badge>
                    {g.period.status === "cerrado" && <Badge tone="neutral">Periodo cerrado</Badge>}
                    {!g.active && <Badge tone="warning">Inactivo</Badge>}
                  </div>
                  <ul className="mt-4 space-y-1 text-sm text-muted">
                    {g.schedule.map((s) => (
                      <li key={`${s.day}-${s.startTime}`} className="flex flex-wrap items-center gap-x-4">
                        <span className="flex items-center gap-2">
                          <Clock className="size-4" aria-hidden /> {DAY_SHORT[s.day]} {s.startTime}–{s.endTime}
                        </span>
                        {s.classroom && (
                          <span className="flex items-center gap-2">
                            <DoorOpen className="size-4" aria-hidden /> {s.classroom.code}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
