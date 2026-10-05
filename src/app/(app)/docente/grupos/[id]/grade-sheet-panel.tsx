"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { grade, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import type { BulkResult, FinalizeResult, GradeSheet } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";

const key = (enrollment: string, evaluation: string) => `${enrollment}:${evaluation}`;
const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

// Nota valida: 0 a 5, maximo 2 decimales (acepta coma o punto)
const parse = (text: string): number | null => {
  const t = text.trim().replace(",", ".");
  if (!/^\d(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 5 ? n : null;
};

export function GradeSheetPanel({ groupId, readOnly }: { groupId: string; readOnly: boolean }) {
  const [sheet, setSheet] = useState<GradeSheet | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [result, setResult] = useState<FinalizeResult | null>(null);

  const load = useCallback(async () => {
    try {
      setSheet(await api<GradeSheet>(`/groups/${groupId}/grade-sheet`));
      setError(null);
    } catch (e) {
      setError(message(e, "No se pudo cargar la planilla"));
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Celdas que cambiaron respecto a lo guardado
  const changes = useMemo(() => {
    if (!sheet) return [];
    const list: { enrollment: string; evaluation: string; text: string; value: number | null; k: string }[] = [];
    for (const row of sheet.rows) {
      for (const ev of sheet.evaluations) {
        const k = key(row.enrollment, ev.id);
        const text = drafts[k];
        if (text === undefined || (text.trim() === "" && row.grades[ev.id] == null)) continue;
        const value = parse(text);
        if (value !== null && value === row.grades[ev.id]) continue;
        list.push({ enrollment: row.enrollment, evaluation: ev.id, text, value, k });
      }
    }
    return list;
  }, [sheet, drafts]);

  const invalid = changes.filter((c) => c.value === null);

  async function save() {
    setSaving(true);
    setNotice(null);
    setResult(null);
    try {
      const items = changes.map((c) => ({ enrollment: c.enrollment, evaluation: c.evaluation, value: c.value as number }));
      const r = await api<BulkResult>("/grades/bulk", { method: "PUT", body: { items } });
      const failedKeys = new Set(r.failed.map((f) => changes[f.index].k));
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => failedKeys.has(k))));
      setNotice(
        r.failed.length === 0
          ? { tone: "success", text: `${r.saved} ${r.saved === 1 ? "nota guardada" : "notas guardadas"}.` }
          : { tone: "danger", text: `${r.saved} guardadas, ${r.failed.length} con error: ${[...new Set(r.failed.map((f) => f.reason))].join(". ")}` },
      );
      await load();
    } catch (e) {
      setNotice({ tone: "danger", text: message(e, "No se pudieron guardar las notas") });
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    setFinalizing(true);
    setNotice(null);
    try {
      setResult(await api<FinalizeResult>(`/groups/${groupId}/finalize`, { method: "POST" }));
      setConfirming(false);
      await load();
    } catch (e) {
      setNotice({ tone: "danger", text: message(e, "No se pudo finalizar el grupo") });
      setConfirming(false);
    } finally {
      setFinalizing(false);
    }
  }

  if (!sheet) return error ? <Alert>{error}</Alert> : <p className="text-sm text-muted">Cargando planilla…</p>;

  if (sheet.evaluations.length === 0) {
    return <EmptyState title="Primero define las evaluaciones" text="Ve a la pestaña “Evaluaciones” y crea el plan (los porcentajes deben sumar 100)." />;
  }
  if (sheet.rows.length === 0) {
    return <EmptyState title="Aún no hay estudiantes matriculados" text="Podrás registrar notas cuando haya estudiantes en el grupo." />;
  }

  const ready = sheet.summary.readyToFinalize;
  const unsaved = changes.length > 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={sheet.summary.planComplete ? "success" : "warning"}>Plan {sheet.summary.totalWeight}%</Badge>
        <Badge tone="primary">{sheet.summary.students} estudiantes</Badge>
        <Badge tone={ready > 0 ? "success" : "neutral"}>{ready} listos para finalizar</Badge>
      </div>

      {!sheet.summary.planComplete && (
        <div className="mb-5">
          <Alert tone="danger">Los porcentajes de las evaluaciones suman {sheet.summary.totalWeight}%, no 100%. Corrígelo en “Evaluaciones” para poder finalizar.</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Planilla de notas del grupo</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="sticky left-0 z-10 min-w-56 border-b border-line bg-surface px-4 py-3 font-semibold">Estudiante</th>
                {sheet.evaluations.map((ev) => (
                  <th key={ev.id} scope="col" className="min-w-28 border-b border-line px-2 py-3 text-center font-semibold">
                    <span className="block text-ink">{ev.name}</span>
                    {ev.weight}%
                  </th>
                ))}
                <th scope="col" className="min-w-24 border-b border-line px-3 py-3 text-center font-semibold">Acumulado</th>
                <th scope="col" className="min-w-32 border-b border-line px-4 py-3 text-right font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => {
                const editable = !readOnly && row.status === "activa";
                return (
                  <tr key={row.enrollment}>
                    <th scope="row" className="sticky left-0 z-10 border-b border-line/60 bg-surface px-4 py-2.5 text-left font-normal">
                      <p className="font-semibold">{row.student.name}</p>
                      <p className="text-xs text-muted">{row.student.code}</p>
                    </th>
                    {sheet.evaluations.map((ev) => {
                      const k = key(row.enrollment, ev.id);
                      const saved = row.grades[ev.id];
                      const draft = drafts[k];
                      const bad = draft !== undefined && parse(draft) === null && (draft.trim() !== "" || saved != null);
                      return (
                        <td key={ev.id} className="border-b border-line/60 px-2 py-2 text-center">
                          {editable ? (
                            <input
                              inputMode="decimal"
                              aria-label={`${ev.name} de ${row.student.name}`}
                              aria-invalid={bad}
                              placeholder="—"
                              value={draft ?? (saved === null ? "" : String(saved))}
                              onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                              className={cn(
                                "min-h-10 w-20 rounded-lg border px-2 text-center font-bold tabular-nums",
                                bad ? "border-danger-600 bg-danger-100" : draft !== undefined && changes.some((c) => c.k === k) ? "border-primary-500 bg-primary-50" : "border-line bg-surface",
                              )}
                            />
                          ) : (
                            <span className="font-bold tabular-nums">{grade(saved)}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-line/60 px-3 py-2 text-center font-bold tabular-nums">{row.evaluatedWeight > 0 ? row.accumulated.toFixed(2) : "—"}</td>
                    <td className="border-b border-line/60 px-4 py-2 text-right">
                      {row.status === "activa" ? (
                        row.readyToFinalize ? (
                          <Badge tone="success">Listo</Badge>
                        ) : (
                          <Badge tone="neutral">Faltan {row.pendingEvaluations}</Badge>
                        )
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                          <span className="text-xs font-bold">{grade(row.finalGrade)}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-xs text-muted">Escribe notas de 0.0 a 5.0 (máximo 2 decimales). Se aprueba con 3.0 o más. Las celdas modificadas se resaltan hasta que las guardes.</p>

      {!readOnly && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-(--radius-card) border border-line bg-surface p-4 shadow-(--shadow-card)">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} loading={saving} disabled={!unsaved || invalid.length > 0}>
              <Save className="size-4" aria-hidden /> Guardar {unsaved ? `${changes.length} ${changes.length === 1 ? "cambio" : "cambios"}` : "cambios"}
            </Button>
            {invalid.length > 0 && <span className="text-sm font-medium text-danger-600">Hay {invalid.length} notas inválidas. Ingresa un valor de 0 a 5 (máx. 2 decimales); una nota guardada no puede quedar vacía.</span>}
          </div>

          {confirming ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar finalización">
              <span className="text-sm font-semibold">
                Se calculará la nota final de {ready} {ready === 1 ? "estudiante" : "estudiantes"}. No se puede deshacer.
              </span>
              <Button loading={finalizing} onClick={finalize}>
                Confirmar
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={finalizing}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirming(true)} disabled={ready === 0 || unsaved || !sheet.summary.planComplete} title={unsaved ? "Guarda los cambios antes de finalizar" : undefined}>
              <CheckCheck className="size-4" aria-hidden /> Finalizar grupo
            </Button>
          )}
        </div>
      )}

      {result && (
        <Card className="mt-6 p-5">
          <h2 className="font-bold">Resultado de la finalización</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="success">{result.passed} aprobados</Badge>
            <Badge tone="danger">{result.failed} reprobados</Badge>
            <Badge tone={result.skipped > 0 ? "warning" : "neutral"}>{result.skipped} omitidos</Badge>
          </div>
          {result.details.skipped.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {result.details.skipped.map((s) => (
                <li key={s.student}>
                  <strong className="text-ink">{s.student}</strong>: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
