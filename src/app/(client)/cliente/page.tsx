"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress" // Se der erro, remova ou instale: npx shadcn-ui@latest add progress
import { QrCode, Gift, ChevronRight, Star } from "lucide-react"
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

export default function ClienteHome() {
  const [pontos, setPontos] = useState(1250)
  const metaProximoPremio = 1500

  // Cálculo visual da barra de progresso
  const progresso = Math.min((pontos / metaProximoPremio) * 100, 100)

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho de Boas Vindas */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Olá, Sérgio! 👋</h1>
          <p className="text-muted-foreground">Café do Sérgio - Cliente Vip</p>
        </div>
      </div>

      {/* Card de Pontos (Estilo Cartão de Crédito) */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 shadow-lg">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-primary-foreground/80">Seu Saldo Atual</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tracking-tight">{pontos}</span>
            <span className="text-lg font-medium">pts</span>
          </div>
          
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-medium text-primary-foreground/90">
              <span>Próximo prêmio: Café Expresso</span>
              <span>{metaProximoPremio} pts</span>
            </div>
            {/* Se não instalou o Progress, substitua por uma div simples */}
            <div className="h-2 w-full rounded-full bg-black/20">
              <div 
                className="h-2 rounded-full bg-white transition-all duration-500" 
                style={{ width: `${progresso}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Botões de Ação Rápida */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* AÇÃO: PONTUAR */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button className="h-auto flex-col gap-3 py-6 text-base" size="lg">
              <QrCode className="h-8 w-8" />
              Pontuar Agora
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle className="text-center">Mostre ao caixa</DrawerTitle>
                <DrawerDescription className="text-center">
                  O atendente irá escanear este código para adicionar seus pontos.
                </DrawerDescription>
              </DrawerHeader>
              <div className="p-4 pb-8 flex justify-center">
                 {/* Placeholder de QR Code */}
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <QrCode className="h-48 w-48 text-black" />
                </div>
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>

        {/* AÇÃO: RESGATAR */}
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
                <DrawerTitle>Prêmios Disponíveis</DrawerTitle>
                <DrawerDescription>Selecione um prêmio para gerar o voucher.</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex gap-3 items-center">
                        <div className="bg-primary/10 p-2 rounded-md">
                            <Gift className="h-5 w-5 text-primary"/>
                        </div>
                        <div>
                            <p className="font-bold text-sm">Vale R$ 50,00</p>
                            <p className="text-xs text-muted-foreground">Custo: 500 pts</p>
                        </div>
                    </div>
                    <Button size="sm">Resgatar</Button>
                  </div>
                ))}
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Histórico Recente (Resumo) */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimas Movimentações</h2>
          <Button variant="link" className="text-primary h-auto p-0" asChild>
            <a href="/cliente/historico">Ver tudo <ChevronRight className="h-4 w-4" /></a>
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {[1, 2, 3].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Star className="h-4 w-4 text-green-700" fill="currentColor" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Compra na Loja</p>
                    <p className="text-xs text-muted-foreground">Hoje, 14:30</p>
                  </div>
                </div>
                <span className="font-bold text-green-600">+150 pts</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}