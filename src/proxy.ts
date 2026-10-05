import { NextRequest, NextResponse } from "next/server";
import { COOKIE, HOME, decodeToken, type Role } from "@/lib/session";

// Revision rapida ANTES de cargar cada pagina: sin sesion -> login; rol equivocado -> su propio inicio.
// No reemplaza a la seguridad real: el backend valida el token y los permisos en cada llamada.
const AREAS: Record<string, Role> = { "/admin": "admin", "/docente": "docente", "/estudiante": "estudiante" };

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session = decodeToken(request.cookies.get(COOKIE)?.value);

  if (pathname === "/login") {
    // Con ?expired=1 se deja ver el login aunque quede una cookie vieja
    if (session && !searchParams.has("expired")) return NextResponse.redirect(new URL(HOME[session.role], request.url));
    return NextResponse.next();
  }

  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const area = Object.keys(AREAS).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (area && AREAS[area] !== session.role) return NextResponse.redirect(new URL(HOME[session.role], request.url));

  return NextResponse.next();
}

export const config = {
  // Todo menos la API interna, los archivos de Next y los recursos estaticos
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
