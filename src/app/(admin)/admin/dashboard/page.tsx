"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, TrendingUp, AlertCircle, Check, X, ArrowUpRight, ArrowDownLeft, RefreshCcw, Trash2, Loader2 } from "lucide-react"

// Dados Iniciais (Mock) para manter a dashboard bonita na apresentação
const initialRequests = [
  { id: 991, cliente: "Ana Silva", tipo: "INCLUSAO", valor: 150, data: "10:30", status: "PENDENTE", nota_fiscal: null },
  { id: 992, cliente: "Carlos Souza", tipo: "RESGATE", valor: 500, data: "09:45", status: "PENDENTE", nota_fiscal: null },
  { id: 993, cliente: "Mariana Lima", tipo: "INCLUSAO", valor: 85, data: "Ontem", status: "PENDENTE", nota_fiscal: null },
  { id: 994, cliente: "João Pedro", tipo: "RESGATE", valor: 1000, data: "Ontem", status: "APROVADO", nota_fiscal: null },
  { id: 995, cliente: "Roberto Dias", tipo: "INCLUSAO", valor: 200, data: "Ontem", status: "REJEITADO", nota_fiscal: null },
]

export default function AdminDashboard() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)

  // Função para buscar dados do Supabase
  const fetchRequests = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('solicitacoes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Erro ao buscar:", error)
    } else {
      const formattedData = (data || []).map(item => ({
        id: item.id,
        cliente: item.cliente_nome,
        tipo: item.tipo,
        valor: item.valor,
        nota_fiscal: item.nota_fiscal,
        data: new Date(item.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}), 
        status: item.status
      }))

      // Une dados reais com os mocks
      setRequests([...formattedData, ...initialRequests])
    }
    setLoading(false)
  }

  // --- NOVA LÓGICA DE APROVAÇÃO/REJEIÇÃO ---
  const handleUpdateStatus = async (id: number, newStatus: 'APROVADO' | 'REJEITADO') => {
    setProcessingId(id)

    // 1. Tenta atualizar no Supabase
    const { error } = await supabase
      .from('solicitacoes')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      console.log("Erro ao atualizar (provavelmente dado mockado):", error.message)
    }

    // 2. Atualiza a lista localmente
    setRequests(prev => prev.map(req => 
      req.id === id ? { ...req, status: newStatus } : req
    ))

    setProcessingId(null)
  }
  // -------------------------------------------

  useEffect(() => {
    fetchRequests()
  }, [])

  // Métricas Calculadas
  const metrics = {
    totalClientes: 1248,
    pontosCirculacao: 45200,
    solicitacoesPendentes: requests.filter(r => r.status === 'PENDENTE').length
  }

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-slate-500">Visão geral da sua loja hoje.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
             <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}/> 
             Atualizar Lista
           </Button>
          <Button>Nova Venda (Pontuar)</Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalClientes}</div>
            <p className="text-xs text-slate-500">+12% em relação ao mês passado</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos em Circulação</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pontosCirculacao.toLocaleString()}</div>
            <p className="text-xs text-slate-500">Saldo atual dos clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitações Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.solicitacoesPendentes}</div>
            <p className="text-xs text-slate-500">Requerem sua atenção imediata</p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Solicitações */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Solicitações Recentes</CardTitle>
            <CardDescription>
              Aprovar inclusão de pontos ou resgates de prêmios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="todos" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="inclusao">Inclusão</TabsTrigger>
                <TabsTrigger value="resgate">Resgates</TabsTrigger>
              </TabsList>
              
              <TabsContent value="todos" className="space-y-4">
                {requests.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma solicitação.</p>}
                
                {requests.map((req) => (
                  <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors gap-4">
                    
                    {/* Informações */}
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${req.tipo === 'INCLUSAO' ? 'bg-green-100' : 'bg-blue-100'}`}>
                        {req.tipo === 'INCLUSAO' ? (
                          <ArrowUpRight className={`h-5 w-5 ${req.tipo === 'INCLUSAO' ? 'text-green-600' : 'text-blue-600'}`} />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium">{req.cliente}</p>
                            {req.nota_fiscal && <Badge variant="outline" className="text-[10px] text-muted-foreground">NF: {req.nota_fiscal}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">
                          {req.tipo === 'INCLUSAO' ? 'Solicitou pontuar' : 'Solicitou resgate de'}
                          <span className="font-bold ml-1">{req.valor} pts</span>
                        </p>
                      </div>
                    </div>

                    {/* Status e Ações */}
                    <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                      <div className="text-sm text-slate-400">{req.data}</div>
                      
                      {req.status === 'PENDENTE' ? (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => handleUpdateStatus(req.id, 'REJEITADO')}
                            disabled={processingId === req.id}
                          >
                            {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4 md:mr-1" />} 
                            <span className="hidden md:inline">Rejeitar</span>
                          </Button>
                          
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateStatus(req.id, 'APROVADO')}
                            disabled={processingId === req.id}
                          >
                             {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 md:mr-1" />}
                            <span className="hidden md:inline">Aprovar</span>
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={req.status === 'APROVADO' ? 'default' : 'destructive'}>
                          {req.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="inclusao" className="space-y-4">
                {requests.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma solicitação.</p>}
                
                {requests
                  .filter((req) => req.tipo==='INCLUSAO')
                  .map((req) => (
                  <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors gap-4">
                    
                    {/* Informações */}
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${req.tipo === 'INCLUSAO' ? 'bg-green-100' : 'bg-blue-100'}`}>
                        {req.tipo === 'INCLUSAO' ? (
                          <ArrowUpRight className={`h-5 w-5 ${req.tipo === 'INCLUSAO' ? 'text-green-600' : 'text-blue-600'}`} />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium">{req.cliente}</p>
                            {req.nota_fiscal && <Badge variant="outline" className="text-[10px] text-muted-foreground">NF: {req.nota_fiscal}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">
                          {req.tipo === 'INCLUSAO' ? 'Solicitou pontuar' : 'Solicitou resgate de'}
                          <span className="font-bold ml-1">{req.valor} pts</span>
                        </p>
                      </div>
                    </div>

                    {/* Status e Ações */}
                    <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                      <div className="text-sm text-slate-400">{req.data}</div>
                      
                      {req.status === 'PENDENTE' ? (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => handleUpdateStatus(req.id, 'REJEITADO')}
                            disabled={processingId === req.id}
                          >
                            {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4 md:mr-1" />} 
                            <span className="hidden md:inline">Rejeitar</span>
                          </Button>
                          
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateStatus(req.id, 'APROVADO')}
                            disabled={processingId === req.id}
                          >
                             {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 md:mr-1" />}
                            <span className="hidden md:inline">Aprovar</span>
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={req.status === 'APROVADO' ? 'default' : 'destructive'}>
                          {req.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="resgate" className="space-y-4">
                {requests.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma solicitação.</p>}
                
                {requests
                  .filter((req) => req.tipo==='RESGATE')
                  .map((req) => (
                  <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors gap-4">
                    
                    {/* Informações */}
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${req.tipo === 'INCLUSAO' ? 'bg-green-100' : 'bg-blue-100'}`}>
                        {req.tipo === 'INCLUSAO' ? (
                          <ArrowUpRight className={`h-5 w-5 ${req.tipo === 'INCLUSAO' ? 'text-green-600' : 'text-blue-600'}`} />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium">{req.cliente}</p>
                            {req.nota_fiscal && <Badge variant="outline" className="text-[10px] text-muted-foreground">NF: {req.nota_fiscal}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">
                          {req.tipo === 'INCLUSAO' ? 'Solicitou pontuar' : 'Solicitou resgate de'}
                          <span className="font-bold ml-1">{req.valor} pts</span>
                        </p>
                      </div>
                    </div>

                    {/* Status e Ações */}
                    <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                      <div className="text-sm text-slate-400">{req.data}</div>
                      
                      {req.status === 'PENDENTE' ? (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => handleUpdateStatus(req.id, 'REJEITADO')}
                            disabled={processingId === req.id}
                          >
                            {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4 md:mr-1" />} 
                            <span className="hidden md:inline">Rejeitar</span>
                          </Button>
                          
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateStatus(req.id, 'APROVADO')}
                            disabled={processingId === req.id}
                          >
                             {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 md:mr-1" />}
                            <span className="hidden md:inline">Aprovar</span>
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={req.status === 'APROVADO' ? 'default' : 'destructive'}>
                          {req.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}