"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSkeleton } from "@/components/auth/auth-skeleton";
import { MerchantLoginForm } from "@/components/auth/merchant-login-form";
import { CustomerLoginForm } from "@/components/auth/customer-login-form";
import { RecoverPasswordPanel } from "@/components/auth/recover-password-panel";
import { TermsPanel } from "@/components/auth/terms-panel";

import { formatCnpj } from "@/lib/formatters/cnpj";

type AuthTab = "merchant" | "customer";
type ViewMode = "login" | "recover" | "terms";

export default function LoginPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AuthTab>("merchant");
  const [viewMode, setViewMode] = useState<ViewMode>("login");

  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantPassword, setMerchantPassword] = useState("");

  const [customerCnpj, setCustomerCnpj] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");

  const [merchantShowPassword, setMerchantShowPassword] = useState(false);
  const [customerShowPassword, setCustomerShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 900);

    return () => clearTimeout(timer);
  }, []);

  function handleTabToggle() {
    setActiveTab((prev) => (prev === "merchant" ? "customer" : "merchant"));
    setError("");
  }

  function handleCustomerCnpjChange(value: string) {
    setCustomerCnpj(formatCnpj(value));
  }

  async function handleMerchantLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: merchantEmail,
      password: merchantPassword,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setTimeout(() => {
      router.push("/lojista");
    }, 700);
  }

  async function handleCustomerLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const normalizedCnpj = customerCnpj.replace(/\D/g, "");

    if (normalizedCnpj.length !== 14) {
      setError("Informe um CNPJ válido.");
      setLoading(false);
      return;
    }

    setTimeout(() => {
      setLoading(false);
      router.push("/cliente");
    }, 700);
  }

  const titles = useMemo(() => {
    if (viewMode === "recover") {
      return {
        title: "Recuperar acesso",
        description:
          "Siga as instruções para retomar o acesso à sua conta com segurança.",
        rightTitle: "Recupere sua conta sem complicação.",
        rightDescription:
          "Um fluxo simples e elegante para orientar o usuário durante a recuperação de acesso.",
      };
    }

    if (viewMode === "terms") {
      return {
        title: "Termos e condições",
        description:
          "Leia as condições de uso da plataforma antes de continuar.",
        rightTitle: "Transparência desde o primeiro acesso.",
        rightDescription:
          "Organize o fluxo de autenticação sem abrir modais pesados ou tirar o usuário do contexto.",
      };
    }

    if (activeTab === "merchant") {
      return {
        title: "Login do lojista",
        description:
          "Entre com sua conta para acessar o painel e gerenciar sua operação.",
        rightTitle: "Um acesso elegante para uma operação profissional.",
        rightDescription:
          "Fluxo moderno, contraste forte e foco total na experiência de autenticação do lojista.",
      };
    }

    return {
      title: "Login do cliente",
      description:
        "Acesse sua área utilizando CNPJ e senha com um fluxo simples e direto.",
      rightTitle: "Acesso rápido para o cliente final.",
      rightDescription:
        "Uma interface pensada para facilitar a autenticação e manter a experiência clara em qualquer dispositivo.",
    };
  }, [activeTab, viewMode]);

  if (initialLoading) {
    return <AuthSkeleton />;
  }

  const isMerchant = activeTab === "merchant";

  return (
    <AuthShell
      title={titles.title}
      description={titles.description}
      rightTitle={titles.rightTitle}
      rightDescription={titles.rightDescription}
    >
      <div className="relative min-h-[460px]">
        <div
          className={viewMode === "login" ? "relative" : "pointer-events-none absolute inset-0"}
          style={{
            opacity: viewMode === "login" ? 1 : 0,
            transform: viewMode === "login" ? "translateY(0px)" : "translateY(12px)",
            transition: "opacity 300ms ease, transform 300ms ease",
          }}
        >
          <div className="mb-6">
            <button
              type="button"
              onClick={handleTabToggle}
              aria-label={
                isMerchant
                  ? "Trocar para login de cliente"
                  : "Trocar para login de lojista"
              }
              className="relative block h-14 w-full select-none overflow-hidden rounded-2xl bg-zinc-100 p-1"
            >
              <div
                className="absolute top-1 left-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-[14px] bg-white shadow-sm will-change-transform"
                style={{
                  transform: isMerchant
                    ? "translate3d(0, 0, 0)"
                    : "translate3d(calc(100% + 4px), 0, 0)",
                  transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />

              <div className="relative z-10 grid h-full grid-cols-2">
                <div
                  className={`flex items-center justify-center rounded-[14px] text-sm font-medium transition-colors duration-300 ${
                    isMerchant ? "text-zinc-950" : "text-zinc-500"
                  }`}
                >
                  Lojista
                </div>

                <div
                  className={`flex items-center justify-center rounded-[14px] text-sm font-medium transition-colors duration-300 ${
                    !isMerchant ? "text-zinc-950" : "text-zinc-500"
                  }`}
                >
                  Cliente
                </div>
              </div>
            </button>
          </div>

          <div className="min-h-[360px] overflow-hidden">
            <div
              className="flex w-[200%] will-change-transform"
              style={{
                transform: isMerchant
                  ? "translate3d(0%, 0, 0)"
                  : "translate3d(-50%, 0, 0)",
                transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <div className="w-1/2 shrink-0 pr-2">
                <MerchantLoginForm
                  email={merchantEmail}
                  password={merchantPassword}
                  error={isMerchant ? error : ""}
                  loading={loading && isMerchant}
                  showPassword={merchantShowPassword}
                  onToggleShowPassword={() =>
                    setMerchantShowPassword((prev) => !prev)
                  }
                  onEmailChange={setMerchantEmail}
                  onPasswordChange={setMerchantPassword}
                  onSubmit={handleMerchantLogin}
                  onRecoverPassword={() => {
                    setError("");
                    setViewMode("recover");
                  }}
                  onOpenTerms={() => {
                    setError("");
                    setViewMode("terms");
                  }}
                />
              </div>

              <div className="w-1/2 shrink-0 pl-2">
                <CustomerLoginForm
                  cnpj={customerCnpj}
                  password={customerPassword}
                  error={!isMerchant ? error : ""}
                  loading={loading && !isMerchant}
                  showPassword={customerShowPassword}
                  onToggleShowPassword={() =>
                    setCustomerShowPassword((prev) => !prev)
                  }
                  onCnpjChange={handleCustomerCnpjChange}
                  onPasswordChange={setCustomerPassword}
                  onSubmit={handleCustomerLogin}
                  onRecoverPassword={() => {
                    setError("");
                    setViewMode("recover");
                  }}
                  onOpenTerms={() => {
                    setError("");
                    setViewMode("terms");
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className={viewMode === "recover" ? "relative" : "pointer-events-none absolute inset-0"}
          style={{
            opacity: viewMode === "recover" ? 1 : 0,
            transform: viewMode === "recover" ? "translateY(0px)" : "translateY(12px)",
            transition: "opacity 300ms ease, transform 300ms ease",
          }}
        >
          <RecoverPasswordPanel
            activeTab={activeTab}
            onBack={() => setViewMode("login")}
          />
        </div>

        <div
          className={viewMode === "terms" ? "relative" : "pointer-events-none absolute inset-0"}
          style={{
            opacity: viewMode === "terms" ? 1 : 0,
            transform: viewMode === "terms" ? "translateY(0px)" : "translateY(12px)",
            transition: "opacity 300ms ease, transform 300ms ease",
          }}
        >
          <TermsPanel onBack={() => setViewMode("login")} />
        </div>
      </div>
    </AuthShell>
  );
}