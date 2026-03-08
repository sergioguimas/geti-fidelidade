type TableEmptyStateProps = {
  title: string;
  description: string;
};

export function TableEmptyState({
  title,
  description,
}: TableEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}