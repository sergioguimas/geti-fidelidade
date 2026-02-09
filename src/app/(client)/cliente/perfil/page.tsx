"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Mail, Phone, User, ShieldCheck } from "lucide-react"
import Link from "next/link"

export default function PerfilPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais.</p>
      </div>

      {/* Cartão de Identificação */}
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
          <AvatarImage src="/placeholder-user.jpg" />
          <AvatarFallback className="text-2xl bg-primary text-primary-foreground">SE</AvatarFallback>
        </Avatar>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold">Sérgio</h2>
          <p className="text-sm text-muted-foreground">Membro desde Jan/2026</p>
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
            <ShieldCheck className="w-3 h-3 mr-1" /> Cliente VIP
          </div>
        </div>
      </div>

      {/* Formulário (Read Only por enquanto) */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Cadastrais</CardTitle>
          <CardDescription>Informações utilizadas para contato e promoções.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <div className="relative">
              <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="name" defaultValue="Sérgio" className="pl-9" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="email" defaultValue="sergio@email.com" className="pl-9" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="phone" defaultValue="(11) 99999-9999" className="pl-9" />
            </div>
          </div>

          <Button className="w-full mt-4" variant="outline">
            Editar Informações
          </Button>
        </CardContent>
      </Card>

      {/* Botão de Logout */}
      <div className="pt-4">
        <Button variant="destructive" className="w-full gap-2" asChild>
          <Link href="/login">
            <LogOut className="h-4 w-4" />
            Sair do Aplicativo
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-4 pb-8 md:pb-0">
          Versão 1.0.0 • Geti Fidelidade
        </p>
      </div>
    </div>
  )
}