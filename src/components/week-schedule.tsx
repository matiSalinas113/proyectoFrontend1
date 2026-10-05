import { Clock, DoorOpen, User, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { DAYS, DAY_LABEL, subjectTone } from "@/lib/format";
import type { Day, ScheduleSlot } from "@/lib/types";

type Slot = ScheduleSlot & { enrolled?: number };

// Semana de lunes a sabado, compartida por estudiante y docente
export function WeekSchedule({ byDay }: { byDay: Partial<Record<Day, Slot[]>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {DAYS.map((day) => {
        const slots = byDay[day] ?? [];
        return (
          <Card key={day} className={cn("p-5", slots.length === 0 && "bg-canvas shadow-none")}>
            <h2 className="mb-3 font-extrabold">{DAY_LABEL[day]}</h2>
            {slots.length === 0 ? (
              <p className="text-sm text-muted">Sin clases</p>
            ) : (
              <ul className="space-y-3">
                {slots.map((s, i) => (
                  <li key={`${s.subject.code}-${s.group}-${s.startTime}-${i}`} className={cn("rounded-xl border p-3.5", subjectTone(s.subject.code))}>
                    <p className="flex items-center gap-1.5 text-sm font-bold">
                      <Clock className="size-3.5" aria-hidden /> {s.startTime} – {s.endTime}
                    </p>
                    <p className="mt-1 font-bold text-ink">{s.subject.name}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span>
                        {s.subject.code} · Grupo {s.group}
                      </span>
                      {s.classroom && (
                        <span className="flex items-center gap-1">
                          <DoorOpen className="size-3" aria-hidden /> {s.classroom}
                        </span>
                      )}
                      {s.teacher && (
                        <span className="flex items-center gap-1">
                          <User className="size-3" aria-hidden /> {s.teacher}
                        </span>
                      )}
                      {s.enrolled !== undefined && (
                        <span className="flex items-center gap-1">
                          <Users className="size-3" aria-hidden /> {s.enrolled} estudiantes
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
