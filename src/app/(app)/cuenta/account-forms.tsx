"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

type Notice = { tone: "danger" | "success"; text: string } | null;

export function AccountForms({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const router = useRouter();

  const [newName, setNewName] = useState(name);
  const dirty = newName.trim() !== name.trim();
  const [nameNotice, setNameNotice] = useState<Notice>(null);
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwNotice, setPwNotice] = useState<Notice>(null);
  const [savingPw, setSavingPw] = useState(false);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setSavingName(true);
    setNameNotice(null);
    try {
      await api("/users/me", { method: "PATCH", body: { name: newName.trim() } });
      setNameNotice({ tone: "success", text: "Nombre actualizado." });
      router.refresh();
    } catch (e) {
      setNameNotice({ tone: "danger", text: e instanceof ApiError ? e.message : "No se pudo guardar" });
    } finally {
      setSavingName(false);
    }
  }

  const mismatch = confirm.length > 0 && confirm !== next;

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) return;
    setSavingPw(true);
    setPwNotice(null);
    try {
      await api("/auth/change-password", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      setPwNotice({ tone: "success", text: "Contraseña actualizada. Tu sesión sigue activa." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setPwNotice({ tone: "danger", text: e instanceof ApiError ? e.message : "No se pudo cambiar la contraseña" });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{name}</p>
            <p className="truncate text-sm text-muted">{email}</p>
            <div className="mt-1.5">
              <Badge tone="primary">{roleLabel}</Badge>
            </div>
          </div>
        </div>
        <form onSubmit={saveName} className="space-y-4" noValidate>
          {nameNotice && <Alert tone={nameNotice.tone}>{nameNotice.text}</Alert>}
          <Field label="Nombre completo" name="name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Field label="Correo" name="email" value={email} disabled hint="El correo solo lo puede cambiar un administrador." />
          <Button type="submit" loading={savingName} disabled={!dirty || !newName.trim() || newName.trim() === name}>
            Guardar nombre
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-bold">Cambiar contraseña</h2>
        <p className="mb-5 text-sm text-muted">Mínimo 8 caracteres, con letras y números.</p>
        <form onSubmit={savePassword} className="space-y-4" noValidate>
          {pwNotice && <Alert tone={pwNotice.tone}>{pwNotice.text}</Alert>}
          <Field label="Contraseña actual" name="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <Field label="Contraseña nueva" name="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          <Field
            label="Repite la contraseña nueva"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? "Las contraseñas no coinciden" : undefined}
            required
          />
          <Button type="submit" loading={savingPw} disabled={!current || next.length < 8 || next !== confirm}>
            Cambiar contraseña
          </Button>
        </form>
      </Card>
    </div>
  );
}
