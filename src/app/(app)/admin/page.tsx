import type { Metadata } from "next";
import { Building2, CalendarDays, GraduationCap, Layers, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { StatCard } from "@/components/stat-card";
import { apiGet } from "@/lib/server";
import type { Dashboard } from "@/lib/types";

export const metadata: Metadata = { title: "Inicio" };

const STATUS_LABEL: Record<string, string> = { activa: "Activas", aprobada: "Aprobadas", reprobada: "Reprobadas", cancelada: "Canceladas" };

export default async function AdminHome() {
  const d = await apiGet<Dashboard>("/reports/dashboard");
  const p = d.currentPeriod;

  return (
    <>
      <PageHeader title="Panel general" subtitle="Indicadores de toda la universidad." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label="Estudiantes activos" value={d.active.students} />
        <StatCard icon={Users} label="Docentes activos" value={d.active.teachers} />
        <StatCard icon={Layers} label="Programas" value={d.active.programs} hint={`${d.active.subjects} materias activas`} />
        <StatCard icon={Building2} label="Facultades" value={d.faculties} hint={`${d.active.classrooms} salones activos`} />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">Periodo abierto</h2>
      {p ? (
        <Card>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm text-muted">Periodo</p>
                <p className="text-xl font-extrabold">{p.code}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted">Grupos</p>
              <p className="text-xl font-extrabold">{p.groups}</p>
            </div>
            <div className="min-w-48 flex-1">
              <p className="text-sm text-muted">
                Ocupación de cupos: {p.enrolled} de {p.capacity} ({p.occupancyPercent}%)
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-primary-100" role="progressbar" aria-valuenow={p.occupancyPercent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.min(p.occupancyPercent, 100)}%` }} />
              </div>
            </div>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <li key={key}>
                <p className="text-sm text-muted">{label}</p>
                <p className="text-xl font-extrabold">{p.enrollmentsByStatus[key] ?? 0}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="No hay un periodo abierto" text="Abre un periodo para que los estudiantes puedan matricularse." />
      )}
    </>
  );
}
