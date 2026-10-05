import type { Metadata } from "next";
import { BookOpen, CalendarDays, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/feedback";
import { StatCard } from "@/components/stat-card";
import { apiGet, apiGetOrNull } from "@/lib/server";
import type { Me, Notification, Paginated, Period } from "@/lib/types";

export const metadata: Metadata = { title: "Inicio" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function StudentHome() {
  const [me, period, notifications] = await Promise.all([
    apiGet<Me>("/users/me"),
    apiGetOrNull<Period>("/periods/current"),
    apiGetOrNull<Paginated<Notification> & { unread: number }>("/notifications/mine?limit=1"),
  ]);
  const active = period
    ? await apiGetOrNull<Paginated<unknown>>(`/enrollments/mine?limit=1&status=activa&period=${period._id}`)
    : null;

  return (
    <>
      <PageHeader title={`Hola, ${me.name.trim().split(/\s+/)[0]}`} subtitle="Este es el resumen de tu periodo académico." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          label="Periodo actual"
          value={period ? period.code : "—"}
          hint={period ? `${fmt(period.startDate)} – ${fmt(period.endDate)}` : "No hay un periodo abierto"}
        />
        <StatCard icon={BookOpen} label="Materias matriculadas" value={active?.meta.total ?? 0} hint="Matrículas activas este periodo" />
        <StatCard icon={Bell} label="Notificaciones sin leer" value={notifications?.unread ?? 0} />
      </div>

    </>
  );
}
