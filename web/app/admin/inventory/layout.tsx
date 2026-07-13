import Link from "next/link";
import { AdminNav } from "@/components/inventory/AdminNav";
import { ThomasHeader } from "@/components/thomas/AdminShell";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between pt-8 pb-2">
        <ThomasHeader subtitle="Inventory" />
        <Link href="/" className="text-sm font-medium text-clay hover:text-cocoa">
          Shop &rarr;
        </Link>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
