"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Gift, ChevronRight, Star, ReceiptText, CheckCircle2, Loader2, Wallet, Ticket } from "lucide-react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"

export default function ClienteHome() {
  const [pontos, setPontos] = useState(0) // Começa com 0 e calcula real
  const [loadingSaldo, setLoadingSaldo] = useState(true)
  const metaProximoPremio = 1500
  
  // Estados do Formulário de Pontuar
  const [notaFiscal, setNotaFiscal] = useState("")
  const [valorGasto, setValorGasto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [sucessoPontuar, setSucessoPontuar] = useState(false)

  // Estados do Resgate
  const [enviandoResgate, setEnviandoResgate] = useState(false)
  const [sucessoResgate, setSucessoResgate] = useState(false)

  // --- LÓGICA DE CALCULAR SALDO REAL ---
  const fetchSaldo = useCallback(async () => {
    try {
      // Busca todas as transações que aprovadas
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('tipo, valor, status')
        .eq('status', 'APROVADO')

      if (error) throw error

      // Calcula o saldo
      let total = 0
      data?.forEach(item => {
        if (item.tipo === 'INCLUSAO') total += Number(item.valor)
        if (item.tipo === 'RESGATE') total -= Number(item.valor)
      })

      setPontos(total)
    } catch (error) {
      console.error("Erro ao buscar saldo:", error)
    } finally {
      setLoadingSaldo(false)
    }
  }, [])

  useEffect(() => {
    fetchSaldo()
  }, [fetchSaldo])
  // ---------------------------------------

  // --- FUNÇÃO DE PONTUAR ---
  const handleEnviarSolicitacao = async () => {
    if (!notaFiscal || !valorGasto) return
    setEnviando(true)

    try {
      const { error } = await supabase.from('solicitacoes').insert({
        cliente_nome: "Sérgio (Eu)",
        tipo: "INCLUSAO",
        valor: parseFloat(valorGasto),
        nota_fiscal: notaFiscal,
        status: "PENDENTE"
      })

      if (error) throw error

      setSucessoPontuar(true)
      setNotaFiscal("")
      setValorGasto("")
      fetchSaldo()
      setTimeout(() => setSucessoPontuar(false), 3000)

    } catch (error) {
      alert("Erro ao enviar.")
    } finally {
      setEnviando(false)
    }
  }

  // --- 3. NOVA FUNÇÃO DE RESGATAR ---
  const handleResgatar = async (valorResgate: number, nomePremio: string) => {
    if (pontos < valorResgate) {
      alert("Saldo insuficiente!")
      return
    }
    
    setEnviandoResgate(true)

    try {
      const { error } = await supabase.from('solicitacoes').insert({
        cliente_nome: "Sérgio (Eu)",
        tipo: "RESGATE",
        valor: valorResgate,
        nota_fiscal: `Resgate: ${nomePremio}`,
        status: "PENDENTE"
      })

      if (error) throw error

      setSucessoResgate(true)
      fetchSaldo()
      setTimeout(() => setSucessoResgate(false), 3000)

    } catch (error) {
      alert("Erro ao resgatar.")
    } finally {
      setEnviandoResgate(false)
    }
  }

  const progresso = Math.min((pontos / metaProximoPremio) * 100, 100)

  // Opções de prêmios fixos para a demo
  const premios = [
    { nome: "Café Expresso", custo: 150 },
    { nome: "Vale R$ 20,00", custo: 200 },
    { nome: "Almoço Executivo", custo: 500 },
  ]

  return (
    <div className="space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Olá, Sérgio! 👋</h1>
          <p className="text-muted-foreground">Café do Sérgio - Cliente Vip</p>
        </div>
      </div>

      {/* CARD DE SALDO */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 shadow-lg">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-primary-foreground/80">Seu Saldo Atual</p>
          <div className="mt-2 flex items-baseline gap-2">
            {loadingSaldo ? (
              <span className="text-5xl font-extrabold tracking-tight animate-pulse">...</span>
            ) : (
              <span className="text-5xl font-extrabold tracking-tight">{pontos}</span>
            )}
            <span className="text-lg font-medium">pts</span>
          </div>
          
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-medium text-primary-foreground/90">
              <span>Próximo prêmio: {metaProximoPremio} pts</span>
              <span>{Math.round(progresso)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-black/20">
              <div className="h-2 rounded-full bg-white transition-all duration-500" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        
        {/* DRAWER PONTUAR */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button className="h-auto flex-col gap-3 py-6 text-base" size="lg">
              <ReceiptText className="h-8 w-8" />
              Pontuar Nota
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle className="text-center">Registrar Compra</DrawerTitle>
                <DrawerDescription className="text-center">Digite o valor da nota para solicitar pontos.</DrawerDescription>
              </DrawerHeader>
              
              <div className="p-4 space-y-4">
                {sucessoPontuar ? (
                  <div className="flex flex-col items-center justify-center py-8 text-green-600 animate-in fade-in zoom-in">
                    <CheckCircle2 className="h-16 w-16 mb-2" />
                    <p className="font-bold text-lg">Solicitação Enviada!</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Loja</Label>
                      <Input value="Café do Sérgio" disabled className="bg-slate-100" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nota Fiscal</Label>
                      <Input placeholder="000123" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor (R$)</Label>
                      <Input type="number" placeholder="0,00" value={valorGasto} onChange={(e) => setValorGasto(e.target.value)} />
                    </div>
                    <Button className="w-full mt-4" onClick={handleEnviarSolicitacao} disabled={enviando || !valorGasto}>
                      {enviando ? <Loader2 className="animate-spin mr-2"/> : "Enviar"}
                    </Button>
                  </>
                )}
              </div>
              <DrawerFooter><DrawerClose asChild><Button variant="outline">Fechar</Button></DrawerClose></DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>

        {/* DRAWER RESGATAR (ATUALIZADO) */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="secondary" className="h-auto flex-col gap-3 py-6 text-base bg-card hover:bg-slate-100 border shadow-sm" size="lg">
              <Gift className="h-8 w-8 text-primary" />
              Resgatar Prêmio
            </Button>
          </DrawerTrigger>
          <DrawerContent>
             <div className="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle>Resgatar Pontos</DrawerTitle>
                <DrawerDescription>Troque seus pontos por recompensas.</DrawerDescription>
              </DrawerHeader>
              
              <div className="p-4 space-y-3">
                {sucessoResgate ? (
                  <div className="flex flex-col items-center justify-center py-8 text-green-600 animate-in fade-in zoom-in">
                    <Ticket className="h-16 w-16 mb-2" />
                    <p className="font-bold text-lg">Resgate Solicitado!</p>
                    <p className="text-sm text-center text-muted-foreground">Mostre o comprovante no caixa.</p>
                  </div>
                ) : (
                  premios.map((item, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${pontos < item.custo ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex gap-3 items-center">
                          <div className="bg-primary/10 p-2 rounded-md">
                              <Gift className="h-5 w-5 text-primary"/>
                          </div>
                          <div>
                              <p className="font-bold text-sm">{item.nome}</p>
                              <p className="text-xs text-muted-foreground">{item.custo} pts</p>
                          </div>
                      </div>
                      <Button 
                        size="sm" 
                        disabled={pontos < item.custo || enviandoResgate}
                        onClick={() => handleResgatar(item.custo, item.nome)}
                      >
                        {enviandoResgate ? <Loader2 className="h-3 w-3 animate-spin"/> : "Resgatar"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <DrawerFooter><DrawerClose asChild><Button variant="outline">Cancelar</Button></DrawerClose></DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Histórico Recente (Puxando do Supabase seria o ideal, mas mantive o mock visual por enquanto para focar no saldo) */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimas Movimentações</h2>
          <Button variant="link" className="text-primary h-auto p-0" asChild>
            <a href="/cliente/historico">Ver tudo <ChevronRight className="h-4 w-4" /></a>
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
             {/* Você pode substituir isso pelo map do supabase depois se quiser */}
             <div className="p-6 text-center text-muted-foreground text-sm">
               Veja seu extrato completo clicando acima.
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}