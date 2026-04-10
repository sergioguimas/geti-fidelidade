import { Suspense } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";
import PrimeiroAcessoForm from "./primeiro-acesso-form";

function PrimeiroAcessoFallback() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
      <Loader2 className="h-4 w-4 animate-spin" />
      Validando seu link de acesso...
    </div>
  );
}

export default function PrimeiroAcessoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <LockKeyhole className="h-5 w-5 text-zinc-300" />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-white">Primeiro acesso</h1>
            <p className="text-sm text-zinc-400">
              Defina sua senha para entrar no sistema.
            </p>
          </div>
        </div>

        <Suspense fallback={<PrimeiroAcessoFallback />}>
          <PrimeiroAcessoForm />
        </Suspense>
      </div>
    </div>
  );
}