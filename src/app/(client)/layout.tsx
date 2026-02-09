"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, History, User, Store, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Função auxiliar para verificar link ativo
  const isActive = (path: string) => pathname === path

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Navbar Desktop (Escondida no Mobile) */}
      <header className="hidden md:flex h-16 items-center border-b bg-card px-6 sticky top-0 z-30">
        <Link href="/cliente" className="flex items-center gap-2 font-bold text-lg text-primary mr-8">
          <Store className="h-5 w-5" />
          Geti Fidelidade
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/cliente" className={isActive("/cliente") ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
            Início
          </Link>
          <Link href="/cliente/historico" className={isActive("/cliente/historico") ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
            Extrato
          </Link>
          <Link href="/cliente/perfil" className={isActive("/cliente/perfil") ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
            Perfil
          </Link>
          <Button className="gap-2" asChild>
            <Link href="/login">
              <LogOut className="h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-3xl mx-auto p-4 md:p-8">
        {children}
      </main>

      {/* Bottom Navigation Mobile (Fixo embaixo) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around z-50 pb-safe">
        <Link href="/cliente" className={`flex flex-col items-center gap-1 p-2 ${isActive("/cliente") ? "text-primary" : "text-muted-foreground"}`}>
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">Início</span>
        </Link>
        <Link href="/cliente/historico" className={`flex flex-col items-center gap-1 p-2 ${isActive("/cliente/historico") ? "text-primary" : "text-muted-foreground"}`}>
          <History className="h-5 w-5" />
          <span className="text-[10px] font-medium">Extrato</span>
        </Link>
        <Link href="/cliente/perfil" className={`flex flex-col items-center gap-1 p-2 ${isActive("/cliente/perfil") ? "text-primary" : "text-muted-foreground"}`}>
          <User className="h-5 w-5" />
          <span className="text-[10px] font-medium">Perfil</span>
        </Link>
      </nav>
    </div>
  )
}