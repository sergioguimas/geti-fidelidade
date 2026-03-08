import {
  CheckCircle2,
  PauseCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";

type Status =
  | "ativo"
  | "inativo"
  | "pendente"
  | "cancelado"
  | "aprovado"
  | "recusado";

type StatusBadgeProps = {
  status: Status;
};

const config = {
  ativo: {
    label: "Ativo",
    icon: CheckCircle2,
    style: "bg-emerald-100 text-emerald-700",
  },
  aprovado: {
    label: "Aprovado",
    icon: CheckCircle2,
    style: "bg-emerald-100 text-emerald-700",
  },
  inativo: {
    label: "Inativo",
    icon: PauseCircle,
    style: "bg-zinc-200 text-zinc-700",
  },
  pendente: {
    label: "Pendente",
    icon: AlertCircle,
    style: "bg-amber-100 text-amber-700",
  },
  cancelado: {
    label: "Cancelado",
    icon: XCircle,
    style: "bg-red-100 text-red-700",
  },
  recusado: {
    label: "Recusado",
    icon: XCircle,
    style: "bg-red-100 text-red-700",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const item = config[status];

  if (!item) return null;

  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${item.style}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}