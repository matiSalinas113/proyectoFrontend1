"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Cancelar pide confirmacion: libera el cupo y no se puede deshacer desde aqui
export function CancelButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      await api(`/enrollments/${id}/cancel`, { method: "PATCH" });
      setConfirming(false);
      router.refresh();
      setLoading(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cancelar");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="secondary" className="min-h-9" onClick={() => setConfirming(true)}>
        Cancelar
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirmar cancelación de ${name}`}>
      {error && <span className="text-xs font-medium text-danger-600">{error}</span>}
      <span className="text-sm font-semibold">¿Cancelar {name}?</span>
      <Button variant="danger" className="min-h-9" loading={loading} onClick={cancel}>
        Sí, cancelar
      </Button>
      <Button variant="ghost" className="min-h-9" disabled={loading} onClick={() => setConfirming(false)}>
        No
      </Button>
    </div>
  );
}
