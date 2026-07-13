"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

type ModuleNavProps = {
  items: NavItem[];
  /** Compact style for mobile warehouse nav */
  variant?: "default" | "compact";
};

export function ModuleNav({ items, variant = "default" }: ModuleNavProps) {
  const pathname = usePathname();
  const compact = variant === "compact";

  return (
    <nav
      className={
        compact
          ? "mb-4 flex gap-2 overflow-x-auto pb-2"
          : "mb-6 flex flex-wrap gap-2 border-b border-sand/60 pb-4"
      }
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 font-semibold transition-colors ${
              compact
                ? `rounded-full px-4 py-2.5 text-sm ${active ? "bg-cocoa text-cream" : "bg-linen text-espresso ring-1 ring-sand"}`
                : `rounded-full px-4 py-1.5 text-xs ${active ? "bg-cocoa text-cream" : "bg-linen text-espresso ring-1 ring-sand hover:bg-sand/40"}`
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
