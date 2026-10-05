import type { Day, EnrollmentStatus } from "./types";

export const DAYS: Day[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export const DAY_LABEL: Record<Day, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
};

export const DAY_SHORT: Record<Day, string> = { lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie", sabado: "Sáb" };

// Escala colombiana 0.0 - 5.0, un decimal en pantalla ("4.5"); sin nota -> guion
export const grade = (value?: number | null): string => (value === undefined || value === null ? "—" : (Math.round((value + Number.EPSILON) * 10) / 10).toFixed(1));

export const date = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  activa: "En curso",
  aprobada: "Aprobada",
  reprobada: "Reprobada",
  cancelada: "Cancelada",
};

export const STATUS_TONE: Record<EnrollmentStatus, "primary" | "success" | "danger" | "neutral"> = {
  activa: "primary",
  aprobada: "success",
  reprobada: "danger",
  cancelada: "neutral",
};

// Color estable por materia (mismo codigo -> mismo color en horario y listas)
const SUBJECT_TONES = [
  "bg-primary-100 text-primary-800 border-primary-200",
  "bg-accent-100 text-accent-600 border-accent-400/40",
  "bg-success-100 text-success-600 border-success-600/20",
  "bg-warning-100 text-warning-600 border-warning-600/20",
  "bg-danger-100 text-danger-600 border-danger-600/20",
];
export const subjectTone = (code: string): string => SUBJECT_TONES[[...code].reduce((s, c) => s + c.charCodeAt(0), 0) % SUBJECT_TONES.length];

// 1 materia / 2 materias
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
