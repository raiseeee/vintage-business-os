"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/fornitori", label: "Supplier Finder" },
  { href: "/crm", label: "CRM fornitori" },
  { href: "/lotti", label: "Acquisti e lotti" },
  { href: "/capi", label: "Capi" },
  { href: "/roadmap", label: "Roadmap" },
];

export function Sidebar() {
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
        {NAV.map((item) => {
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
    </aside>
  );
}
