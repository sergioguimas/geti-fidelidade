import { Pencil, Trash2 } from "lucide-react";

type RowActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  deleteVariant?: "danger" | "neutral";
};

export function RowActions({
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteLabel = "Excluir",
  deleteVariant = "danger",
}: RowActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:scale-115"
        >
          <Pencil className="h-4 w-4" />
          {editLabel}
        </button>
      ) : null}

      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            deleteVariant === "danger"
              ? "border-red-200 bg-white text-red-700 hover:bg-red-50 hover:scale-115"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:scale-115"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          {deleteLabel}
        </button>
      ) : null}
    </div>
  );
}