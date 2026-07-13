import { OpsNav } from "@/components/warehouse/WarehouseUI";
import { ThomasHeader } from "@/components/thomas/AdminShell";

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg px-4 pb-24 pt-6">
      <header className="mb-4">
        <ThomasHeader subtitle="Fulfilment" />
      </header>
      <OpsNav />
      {children}
    </div>
  );
}
