// Cliente de la API para componentes del navegador. Llama a /api/... de ESTE mismo sitio;
// el servidor de Next agrega el token y reenvia al backend (ver src/app/api/[...path]/route.ts).

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "No hay conexion con el servidor");
  }

  if (res.status === 401 && path !== "/auth/login") {
    // Navegacion completa a proposito: descarta todo el estado del navegador al vencer la sesion
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?expired=1";
    throw new ApiError(401, "Sesion vencida");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(". ") : (data?.message ?? "Error inesperado");
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export type { Paginated } from "./types";
