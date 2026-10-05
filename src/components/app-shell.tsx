"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, BookOpen, Building2, DoorOpen, GraduationCap, Layers, Presentation, ShieldCheck, CalendarDays, ClipboardList, History, Home, LogOut, Map, Megaphone, Menu, PlusCircle, User, Users, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { IconName, NavItem } from "@/lib/nav";
import { ROLE_LABEL, type Role } from "@/lib/session";
import { Avatar } from "@/components/ui/avatar";
import { Brand } from "@/components/brand";

const ICONS: Record<IconName, LucideIcon> = {
  home: Home,
  bell: Bell,
  user: User,
  plus: PlusCircle,
  book: BookOpen,
  calendar: CalendarDays,
  grades: ClipboardList,
  history: History,
  map: Map,
  groups: Users,
  building: Building2,
  layers: Layers,
  door: DoorOpen,
  shield: ShieldCheck,
  cap: GraduationCap,
  teacher: Presentation,
  megaphone: Megaphone,
  chart: BarChart3,
};

interface Props {
  name: string;
  role: Role;
  items: NavItem[];
  common: NavItem[];
  children: ReactNode;
}

export function AppShell({ name, role, items, common, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Contador de notificaciones sin leer (se refresca cada minuto)
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ unread: number }>("/notifications/mine?read=false&limit=1")
        .then((r) => alive && setUnread(r.unread))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === items[0]?.href ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const renderLink = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors",
          active ? "bg-primary-600 text-white shadow-sm" : "text-muted hover:bg-primary-50 hover:text-ink",
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
        <span className="flex-1">{item.label}</span>
        {item.icon === "bell" && unread > 0 && (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", active ? "bg-white text-primary-700" : "bg-danger-600 text-white")}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    );
  };

  const sidebar = (
    <nav aria-label="Principal" className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-6 px-1.5 pt-1">
        <Brand />
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={item.href}>
            {item.section && item.section !== items[i - 1]?.section && (
              <p className="mt-5 mb-1.5 px-3.5 text-xs font-bold tracking-wider text-muted uppercase">{item.section}</p>
            )}
            {renderLink(item)}
          </div>
        ))}
      </div>
      <p className="mt-6 mb-2 px-3.5 text-xs font-bold tracking-wider text-muted uppercase">Cuenta</p>
      <div className="space-y-1">{common.map(renderLink)}</div>

      <div className="mt-auto flex items-center gap-3 rounded-xl border border-line bg-canvas p-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-xs text-muted">{ROLE_LABEL[role]}</p>
        </div>
        <button onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-100 hover:text-danger-600">
          <LogOut className="size-[18px]" aria-hidden />
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Escritorio: barra lateral fija */}
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* Movil: barra superior + cajon */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-2.5 lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="relative flex size-11 items-center justify-center rounded-xl hover:bg-primary-50">
          <Menu className="size-5" aria-hidden />
          {unread > 0 && <span className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-danger-600" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl">
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-xl hover:bg-primary-50">
              <X className="size-5" aria-hidden />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
