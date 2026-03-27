export type AdminAuthRow = {
  id: string;
};

export type LojistaVinculoRow = {
  id: string;
  lojista_id: string;
  lojistas: {
    id: string;
    ativo: boolean;
  } | null;
};

export type ClienteAuthRow = {
  id: string;
  ativo: boolean;
  pode_fazer_login: boolean;
  auth_user_id: string | null;
};

export type AuthRole = "admin" | "lojista" | "cliente" | "none";

export type MiddlewareAuthState = {
  isAdmin: boolean;
  isLojista: boolean;
  isCliente: boolean;
  defaultRedirect: "/admin" | "/lojista" | "/cliente" | "/login";
};