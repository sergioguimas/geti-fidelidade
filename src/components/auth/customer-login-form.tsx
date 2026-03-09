import React from "react";
import { onlyDigits, isValidCnpj } from "@/lib/formatters/cnpj";
import { LoadingSpinner } from "@/components/auth/loading-spinner";

interface CustomerLoginFormProps {
  cnpj: string;
  password: string;
  error: string;
  loading: boolean;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onCnpjChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onRecoverPassword: () => void;
  onOpenTerms: () => void;
}

export function CustomerLoginForm({
  cnpj,
  password,
  error,
  loading,
  showPassword,
  onToggleShowPassword,
  onCnpjChange,
  onPasswordChange,
  onSubmit,
  onRecoverPassword,
  onOpenTerms,
}: CustomerLoginFormProps) {
  const digits = onlyDigits(cnpj);
  const hasTyped = digits.length > 0;
  const isComplete = digits.length === 14;
  const isValid = isValidCnpj(cnpj);

  const cnpjStateClass = !hasTyped
    ? "border-zinc-200 bg-zinc-50 focus:border-zinc-400 focus:bg-white"
    : isComplete
    ? isValid
      ? "border-emerald-300 bg-emerald-50/40 focus:border-emerald-400"
      : "border-red-300 bg-red-50/40 focus:border-red-400"
    : "border-amber-300 bg-amber-50/40 focus:border-amber-400";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label
            htmlFor="customer-cnpj"
            className="text-sm font-medium text-zinc-700"
          >
            CNPJ
          </label>

          {hasTyped && (
            <span
              className={`ml-auto shrink-0 text-xs font-medium ${
                isComplete
                  ? isValid
                    ? "text-emerald-600"
                    : "text-red-600"
                  : "text-amber-600"
              }`}
            >
              {isComplete
                ? isValid
                  ? "CNPJ válido"
                  : "CNPJ inválido"
                : "Preenchendo..."}
            </span>
          )}
        </div>

        <input
          id="customer-cnpj"
          type="text"
          inputMode="numeric"
          required
          value={cnpj}
          onChange={(e) => onCnpjChange(e.target.value)}
          className={`h-12 w-full rounded-2xl border px-4 text-sm text-zinc-900 outline-none transition ${cnpjStateClass}`}
          placeholder="00.000.000/0000-00"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="customer-password"
          className="text-sm font-medium text-zinc-700"
        >
          Senha
        </label>

        <div className="relative">
          <input
            id="customer-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 pr-20 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
            placeholder="Digite sua senha"
          />

          <button
            type="button"
            onClick={onToggleShowPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onRecoverPassword}
          className="text-zinc-500 transition hover:text-zinc-900"
        >
          Recuperar senha
        </button>

        <button
          type="button"
          onClick={onOpenTerms}
          className="text-zinc-500 transition hover:text-zinc-900"
        >
          Ler termos
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && <LoadingSpinner />}
        <span>{loading ? "Entrando..." : "Entrar como cliente"}</span>
      </button>
    </form>
  );
}