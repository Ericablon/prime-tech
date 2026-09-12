import type { ReactNode } from "react";

export function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="pt-stat-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {icon ? <div className="pt-icon-box">{icon}</div> : null}
      </div>
    </div>
  );
}
