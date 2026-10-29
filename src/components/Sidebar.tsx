"use client";

import { Boxes, Calculator, ChartLine, LayoutDashboard, LogOut, Menu, Package, Shirt, Store, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/(app)/actions";

type NavItem = { href: string; label: string; Icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/lotti", label: "Acquisti e lotti", Icon: Package },
  { href: "/capi", label: "Capi", Icon: Shirt },
  { href: "/fornitori", label: "Fornitori", Icon: Store },
  { href: "/inventario", label: "Inventario", Icon: Boxes },
  { href: "/statistiche", label: "Statistiche", Icon: ChartLine },
  { href: "/calcolatore", label: "Calcolatore", Icon: Calculator },
];

const OWNER_NAV: NavItem[] = [{ href: "/collaboratori", label: "Collaboratori", Icon: Users }];

/** Le cinque voci della barra in basso (da telefono); la Dashboard è quella centrale e tonda. */
const BOTTOM: NavItem[] = [
  { href: "/lotti", label: "Lotti", Icon: Package },
  { href: "/capi", label: "Capi", Icon: Shirt },
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/inventario", label: "Inventario", Icon: Boxes },
  { href: "/statistiche", label: "Statistiche", Icon: ChartLine },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ email, isOwner = false }: { email: string; isOwner?: boolean }) {
  const pathname = usePathname();
  const items = [...NAV, ...(isOwner ? OWNER_NAV : [])];

  return (
    <>
      {/* iPad e computer: barra laterale */}
      <aside className="hidden w-60 shrink-0 flex-col bg-stone-900 text-stone-300 md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex justify-center px-6 pb-6 pt-8">
          <Link href="/dashboard" aria-label="ARCHVNT, vai alla dashboard">
            <Logo tone="bianco" width={150} />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-white text-stone-900" : "text-stone-300 hover:bg-stone-800 hover:text-white"
                }`}
              >
                <item.Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOut} className="border-t border-stone-800 px-6 py-4">
          <p className="truncate text-xs text-stone-400" title={email}>
            {email}
          </p>
          <button type="submit" className="mt-2 flex items-center gap-2 text-sm font-semibold text-stone-200 hover:text-white">
            <LogOut aria-hidden className="size-4" strokeWidth={1.5} />
            Esci
          </button>
        </form>
      </aside>

      {/* Telefono */}
      <MobileChrome email={email} items={items} pathname={pathname} />
    </>
  );
}

function MobileChrome({ email, items, pathname }: { email: string; items: NavItem[]; pathname: string }) {
  const [compact, setCompact] = useState(false);
  // Il menu è aperto solo per la pagina in cui è stato aperto: cambiando pagina si chiude da solo.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);

  // Il logo si rimpicciolisce scorrendo. Due soglie diverse evitano lo sfarfallio al limite.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCompact((c) => (c ? y > 8 : y > 32));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Il menu si chiude cambiando pagina o con Esc, e blocca lo scorrimento della pagina sotto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Segnaposto: tiene libero lo spazio della barra in alto grande, così la pagina non si sposta. */}
      <div className="h-40" aria-hidden />
      <header
        className={`fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-stone-900 px-4 transition-[height] duration-300 ease-out ${
          compact ? "h-16" : "h-40"
        }`}
      >
        <div className="flex w-24 justify-start">
          <button
            type="button"
            aria-label="Apri il menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="flex size-12 items-center justify-center rounded-md text-white"
          >
            <Menu aria-hidden className="size-6" strokeWidth={1.5} />
          </button>
        </div>
        <Link href="/dashboard" aria-label="ARCHVNT, vai alla dashboard" className="flex justify-center">
          <Logo
            tone="bianco"
            width={160}
            className={`h-auto transition-[width] duration-300 ease-out ${compact ? "w-16" : "w-40"}`}
          />
        </Link>
        <form action={signOut} className="flex w-24 justify-end">
          <button
            type="submit"
            aria-label="Esci"
            className="flex h-6 items-center gap-2 rounded-md border border-stone-600 px-2 text-xs font-semibold text-stone-200"
          >
            <LogOut aria-hidden className="size-4" strokeWidth={1.5} />
            Esci
          </button>
        </form>
      </header>

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Chiudi il menu"
            onClick={() => setOpen(false)}
            className="backdrop-in absolute inset-0 bg-stone-900/60"
          />
          <nav
            aria-label="Menu principale"
            className="drawer-in absolute inset-y-0 left-0 flex w-80 max-w-full flex-col bg-stone-900 text-stone-300"
          >
            <div className="flex h-16 items-center justify-between border-b border-stone-800 pl-6 pr-4">
              <p className="truncate text-xs text-stone-400" title={email}>
                {email}
              </p>
              <button
                type="button"
                aria-label="Chiudi il menu"
                onClick={() => setOpen(false)}
                className="flex size-12 shrink-0 items-center justify-center rounded-md text-white"
              >
                <X aria-hidden className="size-6" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-14 items-center gap-4 rounded-md px-4 text-base font-semibold ${
                      active ? "bg-white text-stone-900" : "text-stone-200 active:bg-stone-800"
                    }`}
                  >
                    <item.Icon aria-hidden className="size-6 shrink-0" strokeWidth={1.5} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <form action={signOut} className="border-t border-stone-800 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <button
                type="submit"
                className="flex h-14 w-full items-center gap-4 rounded-md px-4 text-base font-semibold text-stone-200 active:bg-stone-800"
              >
                <LogOut aria-hidden className="size-6" strokeWidth={1.5} />
                Esci
              </button>
            </form>
          </nav>
        </div>
      )}

      {/* Barra in basso: voci uguali, Dashboard al centro più grande e in un cerchio. */}
      <nav
        aria-label="Navigazione rapida"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-800 bg-stone-900 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5 items-end">
          {BOTTOM.map((item) => {
            const active = isActive(pathname, item.href);
            const center = item.href === "/dashboard";
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={
                    center
                      ? `-mt-6 mb-2 flex size-16 items-center justify-center rounded-full border-4 border-stone-900 ${
                          active ? "bg-white text-stone-900" : "bg-stone-700 text-white"
                        }`
                      : `flex h-16 w-full flex-col items-center justify-center gap-0 text-xs font-semibold ${
                          active ? "text-white" : "text-stone-400"
                        }`
                  }
                >
                  <item.Icon aria-hidden className={center ? "size-8" : "size-6"} strokeWidth={1.5} />
                  {!center && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
