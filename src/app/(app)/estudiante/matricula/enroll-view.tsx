"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, DoorOpen, Search, User, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { DAY_SHORT, subjectTone } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AvailableGroup, AvailableGroups, StudentSchedule } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";

// Limite de creditos por periodo (regla del backend)
const MAX_CREDITS = 20;

export function EnrollView() {
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AvailableGroups | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [groups, schedule] = await Promise.all([
        api<AvailableGroups>(`/students/me/available-groups${all ? "?all=true" : ""}`),
        api<StudentSchedule>("/students/me/schedule")
          .then((schedule) => ({ schedule, error: null }))
          .catch((error: unknown) => ({ schedule: null, error: error instanceof ApiError ? error.message : "No se pudieron consultar los créditos" })),
      ]);
      setData(groups);
      setCredits(schedule.schedule?.credits ?? null);
      setCreditsError(schedule.error);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? { status: e.status, message: e.message } : { status: 0, message: "Error inesperado" });
    }
  }, [all]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function enroll(g: AvailableGroup) {
    setBusy(g.group);
    setNotice(null);
    try {
      await api("/enrollments", { method: "POST", body: { group: g.group } });
      setNotice({ tone: "success", text: `Quedaste matriculado en ${g.subject.name} (grupo ${g.number}).` });
      await load();
    } catch (e) {
      setNotice({ tone: "danger", text: e instanceof ApiError ? e.message : "No se pudo matricular" });
    } finally {
      setBusy(null);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.groups ?? []).filter((g) => !q || g.subject.name.toLowerCase().includes(q) || g.subject.code.toLowerCase().includes(q));
  }, [data, query]);

  if (loadError) {
    return loadError.status === 404 ? (
      <EmptyState title="No hay un periodo abierto" text="Cuando la universidad abra un periodo podrás matricular tus materias aquí." />
    ) : (
      <Alert>{loadError.message}</Alert>
    );
  }
  if (!data) return <p className="text-sm text-muted">Cargando grupos…</p>;

  const pct = credits === null ? 0 : Math.min((credits / MAX_CREDITS) * 100, 100);

  return (
    <>
      <Card className="mb-6 flex flex-wrap items-center gap-x-10 gap-y-4 p-5">
        <div>
          <p className="text-sm text-muted">Periodo</p>
          <p className="text-xl font-extrabold">{data.period.code}</p>
        </div>
        <div className="min-w-56 flex-1">
          <p className="text-sm text-muted">
            Créditos matriculados: <strong className="text-ink">{credits ?? "No disponibles"}</strong> de {MAX_CREDITS}
          </p>
          {credits !== null && <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-primary-100" role="progressbar" aria-valuenow={credits} aria-valuemin={0} aria-valuemax={MAX_CREDITS} aria-label="Créditos matriculados">
            <div className={cn("h-full rounded-full", credits >= MAX_CREDITS ? "bg-accent-400" : "bg-primary-600")} style={{ width: `${pct}%` }} />
          </div>}
          {creditsError && <Alert>{creditsError}</Alert>}
        </div>
      </Card>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1">
          <Field label="Buscar materia" name="q" placeholder="Nombre o código" value={query} onChange={(e) => setQuery(e.target.value)} icon={<Search className="size-4" aria-hidden />} />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-4 text-sm font-semibold">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="size-4 accent-primary-600" />
          Incluir otros programas
        </label>
      </div>

      {notice && (
        <div className="mb-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={query ? "Ninguna materia coincide con tu búsqueda" : "No hay grupos disponibles para ti"}
          text={query ? undefined : all ? "No quedan grupos con cupo que cumplan tus prerrequisitos." : "Prueba con “Incluir otros programas”."}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visible.map((g) => (
            <li key={g.group}>
              <Card className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={cn("inline-block rounded-lg border px-2 py-0.5 text-xs font-bold", subjectTone(g.subject.code))}>{g.subject.code}</span>
                    <h3 className="mt-2 text-lg leading-snug font-bold">{g.subject.name}</h3>
                    <p className="text-sm text-muted">
                      Grupo {g.number} · {g.subject.credits} créditos
                    </p>
                  </div>
                  <Badge tone={g.availableSeats <= 3 ? "warning" : "success"}>
                    <Users className="mr-1 size-3" aria-hidden />
                    {g.availableSeats} {g.availableSeats === 1 ? "cupo" : "cupos"}
                  </Badge>
                </div>

                <ul className="space-y-1.5 text-sm text-muted">
                  <li className="flex items-center gap-2">
                    <User className="size-4 shrink-0" aria-hidden /> {g.teacher ?? "Docente por definir"}
                  </li>
                  {g.schedule.map((s) => (
                    <li key={`${s.day}-${s.startTime}`} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-2">
                        <Clock className="size-4 shrink-0" aria-hidden /> {DAY_SHORT[s.day]} {s.startTime}–{s.endTime}
                      </span>
                      {s.classroom && (
                        <span className="flex items-center gap-2">
                          <DoorOpen className="size-4 shrink-0" aria-hidden /> {s.classroom}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <Button className="mt-auto" loading={busy === g.group} disabled={busy !== null} onClick={() => enroll(g)}>
                  Matricular
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
