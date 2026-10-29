"use client";

import { Boxes, Calculator, ChartLine, LayoutDashboard, Package, Shirt, Store, Users, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/(app)/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/lotti", label: "Acquisti e lotti", Icon: Package },
  { href: "/capi", label: "Capi", Icon: Shirt },
  { href: "/fornitori", label: "Fornitori", Icon: Store },
  { href: "/inventario", label: "Inventario", Icon: Boxes },
  { href: "/statistiche", label: "Statistiche", Icon: ChartLine },
  { href: "/calcolatore", label: "Calcolatore", Icon: Calculator },
];

const OWNER_NAV = [{ href: "/collaboratori", label: "Collaboratori", Icon: Users }];

export function Sidebar({ email, isOwner = false }: { email: string; isOwner?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col bg-stone-900 text-stone-300 md:sticky md:top-0 md:h-screen md:w-60">
      <div className="flex justify-center px-6 pb-4 pt-6 md:pb-6 md:pt-8">
        <Link href="/dashboard" aria-label="ARCHVNT, vai alla dashboard">
          <Logo tone="bianco" width={150} />
        </Link>
      </div>
      <nav className="flex flex-wrap gap-2 px-4 pb-4 md:flex-1 md:flex-col md:flex-nowrap md:overflow-y-auto">
        {[...NAV, ...(isOwner ? OWNER_NAV : [])].map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-white text-stone-900"
                  : "text-stone-300 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <item.Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form
        action={signOut}
        className="flex items-center justify-between gap-4 border-t border-stone-800 px-6 py-4 md:block md:py-4"
      >
        <p className="truncate text-xs text-stone-400" title={email}>
          {email}
        </p>
        <button
          type="submit"
          className="mt-2 flex items-center gap-2 text-sm font-semibold text-stone-200 hover:text-white"
        >
          <LogOut aria-hidden className="size-4" strokeWidth={1.5} />
          Esci
        </button>
      </form>
    </aside>
  );
}
