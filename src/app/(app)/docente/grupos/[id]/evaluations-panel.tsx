"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Evaluation, Paginated } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export function EvaluationsPanel({ groupId, readOnly }: { groupId: string; readOnly: boolean }) {
  const [items, setItems] = useState<Evaluation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api<Paginated<Evaluation>>(`/evaluations?group=${groupId}&limit=100`)).data);
    } catch (e) {
      setError(message(e, "No se pudieron cargar las evaluaciones"));
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const total = (items ?? []).reduce((sum, e) => sum + e.weight, 0);
  const remaining = 100 - total;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (e) {
      setError(message(e, "No se pudo completar la acción"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    const ok = await run(() => api("/evaluations", { method: "POST", body: { group: groupId, name: name.trim(), weight: Number(weight) } }), "Evaluación creada.");
    if (ok) {
      setName("");
      setWeight("");
    }
    setAdding(false);
  }

  async function saveEdit(id: string) {
    const ok = await run(() => api(`/evaluations/${id}`, { method: "PATCH", body: { name: editName.trim(), weight: Number(editWeight) } }), "Evaluación actualizada.");
    if (ok) setEditing(null);
  }

  async function remove(id: string) {
    const ok = await run(() => api(`/evaluations/${id}`, { method: "DELETE" }), "Evaluación eliminada.");
    if (ok) setDeleting(null);
  }

  if (!items) return error ? <Alert>{error}</Alert> : <p className="text-sm text-muted">Cargando…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        {(error || notice) && <div className="mb-4">{error ? <Alert>{error}</Alert> : <Alert tone="success">{notice}</Alert>}</div>}

        {items.length === 0 ? (
          <EmptyState title="Este grupo aún no tiene evaluaciones" text="Define el plan de evaluación: los porcentajes deben sumar 100." />
        ) : (
          <ul className="space-y-3">
            {items.map((ev) => (
              <li key={ev._id}>
                <Card className="p-4 sm:p-5">
                  {editing === ev._id ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-44 flex-1">
                        <Field label="Nombre" name={`n-${ev._id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="w-28">
                        <Field label="Peso (%)" name={`w-${ev._id}`} type="number" min={1} max={100} value={editWeight} onChange={(e) => setEditWeight(e.target.value)} />
                      </div>
                      <Button loading={busy} onClick={() => saveEdit(ev._id)} disabled={!editName.trim() || !editWeight}>
                        Guardar
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-44 flex-1">
                        <p className="font-bold">{ev.name}</p>
                      </div>
                      <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-extrabold text-primary-800">{ev.weight}%</span>
                      {!readOnly &&
                        (deleting === ev._id ? (
                          <div className="flex items-center gap-2" role="group" aria-label={`Confirmar eliminación de ${ev.name}`}>
                            <span className="text-sm font-semibold">¿Eliminar?</span>
                            <Button variant="danger" className="min-h-9" loading={busy} onClick={() => remove(ev._id)}>
                              Sí
                            </Button>
                            <Button variant="ghost" className="min-h-9" onClick={() => setDeleting(null)} disabled={busy}>
                              No
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              aria-label={`Editar ${ev.name}`}
                              title="Editar"
                              onClick={() => {
                                setEditing(ev._id);
                                setEditName(ev.name);
                                setEditWeight(String(ev.weight));
                                setNotice(null);
                                setError(null);
                              }}
                              className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-primary-50 hover:text-ink"
                            >
                              <Pencil className="size-4" aria-hidden />
                            </button>
                            <button
                              aria-label={`Eliminar ${ev.name}`}
                              title="Eliminar"
                              onClick={() => {
                                setDeleting(ev._id);
                                setNotice(null);
                                setError(null);
                              }}
                              className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-danger-100 hover:text-danger-600"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="p-5">
          <p className="text-sm text-muted">Suma de porcentajes</p>
          <p className={cn("text-3xl font-extrabold", total === 100 ? "text-success-600" : "text-ink")}>{total}%</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary-100" role="progressbar" aria-valuenow={total} aria-valuemin={0} aria-valuemax={100} aria-label="Suma de porcentajes">
            <div className={cn("h-full rounded-full", total === 100 ? "bg-success-600" : "bg-primary-600")} style={{ width: `${Math.min(total, 100)}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {total === 100 ? "El plan está completo." : remaining > 0 ? `Faltan ${remaining}% para completar el plan.` : `Te pasaste ${-remaining}%.`}
          </p>
        </Card>

        {!readOnly && (
          <Card className="p-5">
            <h2 className="mb-4 font-bold">Nueva evaluación</h2>
            <form onSubmit={add} className="space-y-4" noValidate>
              <Field label="Nombre" name="new-name" placeholder="Parcial 1" value={name} onChange={(e) => setName(e.target.value)} />
              <Field label="Peso (%)" name="new-weight" type="number" min={1} max={100} placeholder="25" value={weight} onChange={(e) => setWeight(e.target.value)} />
              <Button type="submit" loading={adding} disabled={!name.trim() || !weight || busy} className="w-full">
                <Plus className="size-4" aria-hidden /> Agregar
              </Button>
            </form>
          </Card>
        )}
      </aside>
    </div>
  );
}
