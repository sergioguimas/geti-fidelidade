import type { ReactNode } from "react";

type PageToolbarProps = {
  title: string;
  description: string;
  action: ReactNode;
};

export function PageToolbar({
  title,
  description,
  action,
}: PageToolbarProps) {
  return (
    <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>

      {action ? <div>{action}</div> : null}
    </section>
  );
}