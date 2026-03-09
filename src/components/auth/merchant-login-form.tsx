import React from "react";
import { LoadingSpinner } from "@/components/auth/loading-spinner";

interface MerchantLoginFormProps {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onRecoverPassword: () => void;
  onOpenTerms: () => void;
}

export function MerchantLoginForm({
  email,
  password,
  error,
  loading,
  showPassword,
  onToggleShowPassword,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onRecoverPassword,
  onOpenTerms,
}: MerchantLoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="merchant-email" className="text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="merchant-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
          placeholder="voce@empresa.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="merchant-password" className="text-sm font-medium text-zinc-700">
          Senha
        </label>

        <div className="relative">
          <input
            id="merchant-password"
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
        <span>{loading ? "Entrando..." : "Entrar como lojista"}</span>
      </button>
    </form>
  );
}