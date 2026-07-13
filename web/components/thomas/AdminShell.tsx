"use client";

import Link from "next/link";
import { THOMAS, getClientTenant } from "@/lib/thomas";

type AdminShellProps = {
  title?: string;
  children: React.ReactNode;
  showBack?: boolean;
};

/** Shared Thomas admin header with optional tenant context. */
export function AdminShell({ title, children, showBack = true }: AdminShellProps) {
  const tenant = getClientTenant();

  return (
    <div className="min-h-screen bg-linen/30">
      {showBack && (
        <div className="border-b border-sand/60 bg-white/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href="/admin"
              className="text-sm font-semibold text-cocoa hover:text-espresso"
            >
              &larr; {THOMAS.name} Console
            </Link>
            <span className="text-xs text-muted">{tenant.name}</span>
          </div>
        </div>
      )}
      {title && (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{THOMAS.name}</p>
          <h1 className="font-serif text-2xl text-espresso">{title}</h1>
        </div>
      )}
      {children}
    </div>
  );
}

export function ThomasHeader({ subtitle }: { subtitle?: string }) {
  const tenant = getClientTenant();
  return (
    <header className="mb-4">
      <p className="text-xs uppercase tracking-[0.3em] text-muted">{THOMAS.name}</p>
      <h1 className="font-serif text-2xl text-espresso">{subtitle ?? "Admin"}</h1>
      <p className="text-sm text-muted">{tenant.name}</p>
    </header>
  );
}
