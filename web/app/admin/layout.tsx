"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/thomas/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const isConsole = pathname === "/admin";
  const showBack = !isLogin && !isConsole;

  if (isLogin) {
    return <>{children}</>;
  }

  return <AdminShell showBack={showBack}>{children}</AdminShell>;
}
