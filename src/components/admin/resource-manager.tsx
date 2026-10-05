"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- cada recurso trae su propia forma de fila; se tipa en su configuracion */

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Paginated } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

export type Opt = { value: string; label: string };
export type Slot = { day: string; startTime: string; endTime: string; classroom: string };
export type Value = string | boolean | string[] | Slot[];
export type Values = Record<string, Value>;
export type Lookup = (key: string, id?: string | null) => string;

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "number" | "date" | "select" | "checkbox" | "multiselect" | "schedule";
  required?: boolean;
  hint?: string;
  placeholder?: string;
  mode?: "create" | "edit"; // si se indica, el campo solo aparece en ese modo
  options?: Opt[]; // opciones fijas
  lookup?: string; // opciones tomadas de config.lookups
  optionsFrom?: { endpoint: (v: Values) => string | null; label: (r: any) => string }; // opciones que dependen de otros campos
  min?: number;
  max?: number;
}

export interface FilterDef {
  param: string;
  label: string;
  options?: Opt[];
  lookup?: string;
  text?: boolean; // campo de texto en vez de lista
}

export interface ResourceConfig {
  endpoint: string;
  createTitle: string;
  editTitle: string;
  newLabel: string;
  empty: string;
  search?: { param: string; label: string; placeholder: string };
  filters?: FilterDef[];
  lookups?: Record<string, { endpoint: string; label: (r: any) => string }>;
  columns: { header: string; cell: (row: any, lk: Lookup) => ReactNode; align?: "right" }[];
  fields: FieldDef[];
  initial: (row: any | null) => Values;
  toBody: (values: Values, mode: "create" | "edit") => unknown;
  rowActions?: (row: any, reload: () => void) => ReactNode;
  noEdit?: boolean; // recursos que solo se crean y se operan con acciones (p. ej. matriculas)
  keepOpenIfDirty?: boolean; // no cierra el formulario si hay cambios sin guardar
}

const PAGE_SIZE = 15;
const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export const ACTIVE_OPTIONS: Opt[] = [
  { value: "true", label: "Activos" },
  { value: "false", label: "Inactivos" },
];

export function ResourceManager({ config }: { config: ResourceConfig }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [data, setData] = useState<Paginated<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Record<string, Opt[]>>({});
  const [form, setForm] = useState<{ mode: "create" | "edit"; row: any | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = useRef(false);

  // Cierra el formulario, salvo que el recurso pida conservar los cambios sin guardar
  const closeForm = () => {
    if (config.keepOpenIfDirty && form?.mode === "edit" && dirty.current && !window.confirm("¿Descartar los cambios sin guardar?")) return;
    dirty.current = false;
    setForm(null);
  };

  // Espera 300 ms despues de escribir antes de buscar
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Listas auxiliares (por ejemplo, facultades para filtrar programas)
  useEffect(() => {
    let alive = true;
    Object.entries(config.lookups ?? {}).forEach(([key, def]) => {
      api<Paginated<any>>(def.endpoint)
        .then((r) => alive && setLookups((l) => ({ ...l, [key]: r.data.map((x) => ({ value: x._id, label: def.label(x) })) })))
        .catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, [config]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (config.search && query) params.set(config.search.param, query);
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      setData(await api<Paginated<any>>(`${config.endpoint}?${params}`));
      setError(null);
    } catch (e) {
      setError(message(e, "No se pudo cargar la lista"));
    }
  }, [config, page, query, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const lk: Lookup = (key, id) => (id ? (lookups[key]?.find((o) => o.value === String(id))?.label ?? "—") : "—");
  const optionsOf = (f: { lookup?: string; options?: Opt[] }) => f.options ?? (f.lookup ? (lookups[f.lookup] ?? []) : []);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        {config.search && (
          <div className="min-w-56 flex-1">
            <Field label={config.search.label} name="search" placeholder={config.search.placeholder} value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="size-4" aria-hidden />} />
          </div>
        )}
        {config.filters?.map((f) =>
          f.text ? (
            <div key={f.param} className="w-36">
              <Field
                label={f.label}
                name={`f-${f.param}`}
                value={filters[f.param] ?? ""}
                onChange={(e) => {
                  setFilters((s) => ({ ...s, [f.param]: e.target.value }));
                  setPage(1);
                }}
              />
            </div>
          ) : (
            <div key={f.param} className="w-44">
              <Select
                label={f.label}
                name={`f-${f.param}`}
                placeholder="Todos"
                options={optionsOf(f)}
                value={filters[f.param] ?? ""}
                onChange={(e) => {
                  setFilters((s) => ({ ...s, [f.param]: e.target.value }));
                  setPage(1);
                }}
              />
            </div>
          ),
        )}
        <Button className="ml-auto" onClick={() => setForm({ mode: "create", row: null })}>
          <Plus className="size-4" aria-hidden /> {config.newLabel}
        </Button>
      </div>

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {!data && !error && <p className="text-sm text-muted">Cargando…</p>}

      {data &&
        (data.data.length === 0 ? (
          <EmptyState title={config.empty} text="Prueba cambiando los filtros o crea un registro nuevo." />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    {config.columns.map((c) => (
                      <th key={c.header} scope="col" className={`px-4 py-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                        {c.header}
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr key={row._id} className="border-b border-line/60 last:border-0 hover:bg-primary-50/40">
                      {config.columns.map((c) => (
                        <td key={c.header} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                          {c.cell(row, lk)}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {config.rowActions?.(row, () => void load())}
                          {!config.noEdit && (
                          <button
                            onClick={() => {
                              setNotice(null);
                              setForm({ mode: "edit", row });
                            }}
                            aria-label="Editar"
                            title="Editar"
                            className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-primary-100 hover:text-primary-800"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {data && data.meta.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-muted">
            Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} registros
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button variant="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {data && data.meta.totalPages <= 1 && <p className="mt-4 text-sm text-muted">{data.meta.total} registros</p>}

      <Modal open={!!form} title={form?.mode === "edit" ? config.editTitle : config.createTitle} onClose={closeForm}>
        {form && (
          <RecordForm
            key={form.row?._id ?? "new"}
            config={config}
            mode={form.mode}
            row={form.row}
            lookups={lookups}
            onDirty={(d) => {
              dirty.current = d;
            }}
            onClose={closeForm}
            onSaved={(text) => {
              setForm(null);
              setNotice(text);
              void load();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function RecordForm({
  config,
  mode,
  row,
  lookups,
  onDirty,
  onClose,
  onSaved,
}: {
  config: ResourceConfig;
  mode: "create" | "edit";
  row: any | null;
  lookups: Record<string, Opt[]>;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [values, setValues] = useState<Values>(() => config.initial(row));

  // Avisa al contenedor si el formulario tiene cambios respecto al registro original
  useEffect(() => {
    onDirty(JSON.stringify(values) !== JSON.stringify(config.initial(row)));
  }, [values, row, config, onDirty]);
  const [dynamic, setDynamic] = useState<Record<string, Opt[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fields = config.fields.filter((f) => !f.mode || f.mode === mode);
  const set = (name: string, value: Value) => setValues((v) => {
    const next = { ...v, [name]: value };
    fields.forEach((f) => {
      if (f.optionsFrom && f.optionsFrom.endpoint(v) !== f.optionsFrom.endpoint(next)) {
        next[f.name] = f.type === "multiselect" ? [] : "";
      }
    });
    return next;
  });

  // Opciones que dependen de otros campos (p. ej. prerrequisitos segun el programa elegido)
  const endpoints = fields.map((f) => (f.optionsFrom ? f.optionsFrom.endpoint(values) : null)).join("|");
  useEffect(() => {
    let alive = true;
    fields.forEach((f) => {
      if (!f.optionsFrom) return;
      const url = f.optionsFrom.endpoint(values);
      if (!url) {
        setDynamic((d) => ({ ...d, [f.name]: [] }));
        return;
      }
      api<Paginated<any>>(url)
        .then((r) => alive && setDynamic((d) => ({ ...d, [f.name]: r.data.filter((x) => x._id !== row?._id).map((x) => ({ value: x._id, label: f.optionsFrom!.label(x) })) })))
        .catch(() => undefined);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoints]);

  const missing = fields.some((f) => {
    const v = values[f.name];
    if (!f.required) return false;
    return f.type === "schedule" ? !Array.isArray(v) || v.length === 0 || (v as Slot[]).some((x) => !x.startTime || !x.endTime || !x.classroom) : v === "" || v === undefined;
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = config.toBody(values, mode);
      if (mode === "create") await api(config.endpoint, { method: "POST", body });
      else await api(`${config.endpoint}/${row._id}`, { method: "PATCH", body });
      onSaved(mode === "create" ? "Registro creado correctamente." : "Cambios guardados.");
    } catch (e) {
      setError(message(e, "No se pudo guardar"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const value = values[f.name];
        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={value === true} onChange={(e) => set(f.name, e.target.checked)} className="size-4 accent-primary-600" />
              {f.label}
            </label>
          );
        }
        if (f.type === "select") {
          const options = f.options ?? (f.lookup ? (lookups[f.lookup] ?? []) : []);
          return <Select key={f.name} id={id} name={f.name} label={f.label} hint={f.hint} placeholder="— Selecciona —" options={options} value={String(value ?? "")} onChange={(e) => set(f.name, e.target.value)} />;
        }
        if (f.type === "schedule") {
          return <ScheduleEditor key={f.name} label={f.label} hint={f.hint} slots={(value as Slot[]) ?? []} classrooms={f.lookup ? (lookups[f.lookup] ?? []) : []} onChange={(v) => set(f.name, v)} />;
        }
        if (f.type === "multiselect") {
          const options = dynamic[f.name] ?? [];
          const chosen = (value as string[]) ?? [];
          return (
            <fieldset key={f.name} className="space-y-1.5">
              <legend className="text-sm font-semibold">{f.label}</legend>
              {f.hint && <p className="text-xs text-muted">{f.hint}</p>}
              <div className="max-h-44 overflow-y-auto rounded-xl border border-line p-2">
                {options.length === 0 ? (
                  <p className="p-2 text-sm text-muted">No hay opciones disponibles.</p>
                ) : (
                  options.map((o) => (
                    <label key={o.value} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-primary-50">
                      <input
                        type="checkbox"
                        checked={chosen.includes(o.value)}
                        onChange={(e) => set(f.name, e.target.checked ? [...chosen, o.value] : chosen.filter((x) => x !== o.value))}
                        className="size-4 accent-primary-600"
                      />
                      {o.label}
                    </label>
                  ))
                )}
              </div>
            </fieldset>
          );
        }
        return (
          <Field
            key={f.name}
            id={id}
            name={f.name}
            label={f.label}
            hint={f.hint}
            type={f.type}
            min={f.min}
            max={f.max}
            placeholder={f.placeholder}
            autoComplete={f.type === "password" ? "new-password" : "off"}
            value={String(value ?? "")}
            onChange={(e) => set(f.name, e.target.value)}
          />
        );
      })}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving} disabled={missing}>
          {mode === "create" ? "Crear" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// Etiqueta Activo / Inactivo para las tablas
export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

const DAY_OPTIONS: Opt[] = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
];

// Franjas semanales de un grupo: dia, hora de inicio, hora de fin y salon
function ScheduleEditor({ label, hint, slots, classrooms, onChange }: { label: string; hint?: string; slots: Slot[]; classrooms: Opt[]; onChange: (s: Slot[]) => void }) {
  const update = (i: number, patch: Partial<Slot>) => onChange(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {slots.map((s, i) => (
        <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_6.5rem_6.5rem_1fr_auto]">
          <Select label="Día" options={DAY_OPTIONS} value={s.day} onChange={(e) => update(i, { day: e.target.value })} />
          <Field label="Inicio" type="time" value={s.startTime} onChange={(e) => update(i, { startTime: e.target.value })} />
          <Field label="Fin" type="time" value={s.endTime} onChange={(e) => update(i, { endTime: e.target.value })} />
          <Select label="Salón" placeholder="Salón" options={classrooms} value={s.classroom} onChange={(e) => update(i, { classroom: e.target.value })} />
          <button type="button" onClick={() => onChange(slots.filter((_, j) => j !== i))} aria-label={`Quitar franja ${i + 1}`} className="col-span-2 flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-danger-600 hover:bg-danger-100 sm:col-span-1 sm:w-11">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...slots, { day: "lunes", startTime: "", endTime: "", classroom: "" }])}>
        <Plus className="size-4" aria-hidden /> Agregar franja
      </Button>
    </fieldset>
  );
}
