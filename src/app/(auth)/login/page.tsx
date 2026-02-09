"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Store, User, Lock, ArrowRight, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [userType, setUserType] = useState<"admin" | "cliente">("cliente") // Estado apenas visual para o protótipo
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // SIMULAÇÃO DE API (DELAY DE 1s)
    setTimeout(() => {
      // Lógica Hardcoded para o protótipo
      if (email === "admin@geti.com") {
        router.push("/admin/dashboard")
      } else {
        // Qualquer outro email ou "cliente@geti.com" vai para a área do cliente
        router.push("/cliente")
      }
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Store className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Geti Fidelidade</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Tabs Visuais para facilitar o teste do protótipo */}
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => { setUserType("cliente"); setEmail("cliente@geti.com"); }}
              className={`text-sm font-medium py-1.5 rounded-md transition-all ${
                userType === "cliente" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sou Cliente
            </button>
            <button
              onClick={() => { setUserType("admin"); setEmail("admin@geti.com"); }}
              className={`text-sm font-medium py-1.5 rounded-md transition-all ${
                userType === "admin" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sou Lojista
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="email" 
                  placeholder="seu@email.com" 
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="******" 
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
                </>
              ) : (
                <>
                  Entrar <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-2 text-center text-sm text-slate-500">
          <p>Esqueceu sua senha?</p>
        </CardFooter>
      </Card>
    </div>
  )
}