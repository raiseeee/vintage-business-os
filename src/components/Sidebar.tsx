"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/(app)/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lotti", label: "Acquisti e lotti" },
  { href: "/capi", label: "Capi" },
  { href: "/fornitori", label: "Fornitori" },
  { href: "/inventario", label: "Inventario" },
  { href: "/statistiche", label: "Statistiche" },
  { href: "/calcolatore", label: "Calcolatore" },
];

const OWNER_NAV = [{ href: "/collaboratori", label: "Collaboratori" }];

export function Sidebar({ email, isOwner = false }: { email: string; isOwner?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col bg-stone-900 text-stone-300 md:sticky md:top-0 md:h-screen md:w-60">
      <div className="flex justify-center px-5 pb-3 pt-5 md:pb-6 md:pt-7">
        <Link href="/dashboard" aria-label="ARCHVNT, vai alla dashboard">
          <Logo tone="bianco" width={150} />
        </Link>
      </div>
      <nav className="flex flex-wrap gap-1 px-3 pb-3 md:flex-1 md:flex-col md:flex-nowrap md:overflow-y-auto">
        {[...NAV, ...(isOwner ? OWNER_NAV : [])].map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-stone-900 before:absolute before:inset-y-1.5 before:-left-3 before:hidden before:w-1 before:rounded-r before:bg-[#7d92ff] md:before:block"
                  : "text-stone-300 hover:bg-stone-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form
        action={signOut}
        className="flex items-center justify-between gap-3 border-t border-stone-800 px-5 py-3 md:block md:py-4"
      >
        <p className="truncate text-xs text-stone-400" title={email}>
          {email}
        </p>
        <button
          type="submit"
          className="mt-1 text-sm font-medium text-stone-200 hover:text-white"
        >
          Esci
        </button>
      </form>
    </aside>
  );
}
