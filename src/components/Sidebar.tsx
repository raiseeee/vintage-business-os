"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lotti", label: "Acquisti e lotti" },
  { href: "/capi", label: "Capi" },
  { href: "/fornitori", label: "Fornitori" },
  { href: "/inventario", label: "Inventario" },
  { href: "/statistiche", label: "Statistiche" },
  { href: "/calcolatore", label: "Calcolatore" },
  { href: "/roadmap", label: "Roadmap" },
];

const OWNER_NAV = [{ href: "/collaboratori", label: "Collaboratori" }];

export function Sidebar({ email, isOwner = false }: { email: string; isOwner?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-stone-200 bg-white md:w-60 md:border-r md:border-b-0">
      <div className="px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Vintage
        </p>
        <p className="text-lg font-semibold text-stone-900">Business OS</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {[...NAV, ...(isOwner ? OWNER_NAV : [])].map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form
        action={signOut}
        className="mt-auto flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-3 md:block md:py-4"
      >
        <p className="truncate text-xs text-stone-500" title={email}>
          {email}
        </p>
        <button
          type="submit"
          className="mt-1 text-sm font-medium text-stone-700 hover:text-stone-900"
        >
          Esci
        </button>
      </form>
    </aside>
  );
}
