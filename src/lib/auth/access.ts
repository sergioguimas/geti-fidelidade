import type {
  AdminAuthRow,
  ClienteAuthRow,
  LojistaVinculoRow,
  MiddlewareAuthState,
} from "./types";

export function isLojistaAtivo(vinculo: LojistaVinculoRow | null) {
  return !!vinculo?.lojistas?.ativo;
}

export function buildMiddlewareAuthState(params: {
  admin: AdminAuthRow | null;
  vinculoLojista: LojistaVinculoRow | null;
  cliente: ClienteAuthRow | null;
}): MiddlewareAuthState {
  const isAdmin = !!params.admin;
  const isLojista = isLojistaAtivo(params.vinculoLojista);
  const isCliente = !!params.cliente;

  const defaultRedirect: MiddlewareAuthState["defaultRedirect"] = isAdmin
    ? "/admin"
    : isLojista
    ? "/lojista"
    : isCliente
    ? "/cliente"
    : "/login";

  return {
    isAdmin,
    isLojista,
    isCliente,
    defaultRedirect,
  };
}