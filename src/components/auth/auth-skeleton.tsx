export function AuthSkeleton() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.10),_transparent_35%),linear-gradient(to_bottom_right,_rgba(255,255,255,0.04),_transparent_40%)]" />

      <div className="relative w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl">
        <div className="grid min-h-[680px] grid-cols-1 lg:grid-cols-2">
          <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
            <div className="w-full max-w-md animate-pulse">
              <div className="mb-8">
                <div className="h-7 w-28 rounded-full bg-zinc-200" />
                <div className="mt-4 h-10 w-64 rounded-xl bg-zinc-200" />
                <div className="mt-3 h-4 w-full rounded bg-zinc-100" />
                <div className="mt-2 h-4 w-5/6 rounded bg-zinc-100" />
              </div>

              <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1">
                <div className="h-11 rounded-xl bg-white" />
                <div className="h-11 rounded-xl bg-zinc-200" />
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 h-4 w-16 rounded bg-zinc-200" />
                  <div className="h-12 rounded-2xl bg-zinc-100" />
                </div>

                <div>
                  <div className="mb-2 h-4 w-16 rounded bg-zinc-200" />
                  <div className="h-12 rounded-2xl bg-zinc-100" />
                </div>

                <div className="h-12 rounded-2xl bg-zinc-900/80" />
              </div>
            </div>
          </section>

          <section className="hidden bg-zinc-950 lg:block">
            <div className="h-full w-full animate-pulse p-10">
              <div className="h-7 w-24 rounded-full bg-white/10" />
              <div className="mt-8 h-12 w-3/4 rounded-xl bg-white/10" />
              <div className="mt-4 h-4 w-4/5 rounded bg-white/10" />
              <div className="mt-2 h-4 w-2/3 rounded bg-white/10" />

              <div className="mt-16 rounded-[28px] border border-white/10 bg-white/5 p-6">
                <div className="h-4 w-32 rounded bg-white/10" />
                <div className="mt-6 space-y-3">
                  <div className="h-2 rounded-full bg-white/10" />
                  <div className="h-2 rounded-full bg-white/10" />
                  <div className="h-2 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}