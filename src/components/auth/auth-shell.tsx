import { ReactNode } from "react";

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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.10),_transparent_35%),linear-gradient(to_bottom_right,_rgba(255,255,255,0.04),_transparent_40%)]" />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

      <div className="relative w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl">
        <div className="grid min-h-[680px] grid-cols-1 lg:grid-cols-2">
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

          <section className="relative hidden overflow-hidden bg-zinc-950 lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.10),_transparent_28%)]" />

            <div className="relative z-10 flex w-full flex-col justify-between p-10 text-white">
              <div>
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-medium text-white/80 backdrop-blur">
                  Fidelidade
                </div>

                <h2 className="mt-6 max-w-md text-4xl font-semibold leading-tight">
                  {rightTitle}
                </h2>

                <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
                  {rightDescription}
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Status do ambiente</span>
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-300">
                      Online
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-2 w-[78%] rounded-full bg-white/80" />
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-2 w-[55%] rounded-full bg-white/60" />
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-2 w-[88%] rounded-full bg-white/40" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      Interface
                    </p>
                    <p className="mt-3 text-2xl font-semibold">Clean</p>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      Fluxo
                    </p>
                    <p className="mt-3 text-2xl font-semibold">Ágil</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}