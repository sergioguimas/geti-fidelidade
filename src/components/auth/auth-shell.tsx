import { ReactNode } from "react";
import { ShieldCheck, Zap, Smartphone, CheckCircle2 } from "lucide-react";

interface AuthShellProps {
  title: string;
  description: string;
  rightTitle: string;
  rightDescription: string;
  children: ReactNode;
}

export function AuthShell({
  title,
  description,
  rightTitle,
  rightDescription,
  children,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.10),_transparent_35%),linear-gradient(to_bottom_right,_rgba(255,255,255,0.04),_transparent_40%)]" />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

      <div className="relative w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl">
        <div className="grid min-h-[680px] grid-cols-1 lg:grid-cols-2">
          
          {/* Lado Esquerdo: Formulário */}
          <section className="relative flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
            <div className="w-full max-w-lg">
              <div className="mb-8">
                <div className="mb-3 inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                  Área de acesso
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                  {title}
                </h1>

                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  {description}
                </p>
              </div>

              {children}
            </div>
          </section>

          {/* Lado Direito: Informações de Valor */}
          <section className="relative hidden overflow-hidden bg-zinc-950 lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.10),_transparent_28%)]" />

            <div className="relative z-10 flex w-full flex-col justify-between p-10 text-white">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-medium text-white/80 backdrop-blur">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sistema Ativo
                </div>

                <h2 className="mt-6 max-w-md text-4xl font-semibold leading-tight text-balance">
                  {rightTitle}
                </h2>

                <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
                  {rightDescription}
                </p>
              </div>

              <div className="space-y-4 max-w-[440px]">
                {/* Card de Confiabilidade */}
                <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Conexão Segura</p>
                        <p className="text-xs text-white/50">Seus dados estão protegidos</p>
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 opacity-50" />
                  </div>

                  {/* Barras mais finas e elegantes */}
                  <div className="mt-6 space-y-2">
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full w-[100%] rounded-full bg-emerald-400/40 animate-[shimmer_2s_infinite]" 
                          style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full w-[95%] rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>

                {/* Cards de Benefícios Rápidos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-md flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                        Disponibilidade
                      </p>
                    </div>
                    <p className="text-sm leading-tight font-medium text-white/90">
                      Pronto a todo momento
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-md flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                        <Smartphone className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                        Mobilidade
                      </p>
                    </div>
                    <p className="text-sm leading-tight font-medium text-white/90">
                      Acesse de qualquer lugar
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      
      {/* Estilo para a animação simples de shimmer nas barrinhas */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </main>
  );
}