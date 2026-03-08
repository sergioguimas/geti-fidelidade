import type { ReactNode } from "react";

type TableCardProps = {
  children: ReactNode;
};

export function TableCard({ children }: TableCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}