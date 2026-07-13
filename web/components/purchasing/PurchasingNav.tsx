"use client";

import { ModuleNav } from "@/components/thomas/ModuleNav";

const NAV = [
  { href: "/admin/purchasing", label: "Dashboard", exact: true },
  { href: "/admin/purchasing/suppliers", label: "Suppliers" },
  { href: "/admin/purchasing/brands", label: "Brands" },
  { href: "/admin/purchasing/purchase-orders", label: "Purchase Orders" },
  { href: "/admin/purchasing/shipments", label: "Shipments" },
];

export function PurchasingNav() {
  return <ModuleNav items={NAV} />;
}
