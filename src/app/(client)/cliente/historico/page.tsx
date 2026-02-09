"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowDownLeft, ArrowUpRight, Calendar, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

// DADOS MOCKADOS
const transactions = [
  { id: 1, tipo: 'ENTRADA', descricao: 'Compra na Loja', data: '08/02/2026', valor: 150 },
  { id: 2, tipo: 'SAIDA', descricao: 'Resgate: Vale R$ 50', data: '05/02/2026', valor: -500 },
  { id: 3, tipo: 'ENTRADA', descricao: 'Promoção Dia dos Pais', data: '01/02/2026', valor: 300 },
  { id: 4, tipo: 'ENTRADA', descricao: 'Compra Online', data: '28/01/2026', valor: 120 },
  { id: 5, tipo: 'SAIDA', descricao: 'Resgate: Café Expresso', data: '15/01/2026', valor: -150 },
  { id: 6, tipo: 'ENTRADA', descricao: 'Bônus de Aniversário', data: '10/01/2026', valor: 500 },
]

export default function HistoricoPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Extrato de Pontos</h1>
        <p className="text-muted-foreground">Confira toda a sua movimentação.</p>
      </div>

      {/* Barra de Pesquisa */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filtrar por data ou descrição..."
          className="pl-8 bg-card"
        />
      </div>

      {/* Lista de Transações */}
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="space-y-4">
          {transactions.map((t) => (
            <Card key={t.id} className="overflow-hidden transition-all hover:bg-slate-50/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Ícone Indicativo */}
                  <div className={`p-2.5 rounded-full ${
                    t.tipo === 'ENTRADA' ? 'bg-green-100/50 text-green-600' : 'bg-red-100/50 text-red-600'
                  }`}>
                    {t.tipo === 'ENTRADA' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium leading-none">{t.descricao}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="mr-1 h-3 w-3" />
                      {t.data}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-bold ${
                    t.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {t.tipo === 'ENTRADA' ? '+' : ''}{t.valor} pts
                  </span>
                  <div className="mt-1">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {t.tipo === 'ENTRADA' ? 'Acúmulo' : 'Resgate'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}