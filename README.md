# 🎯 Fidelidade — Plataforma de Loyalty Multi-Tenant

![Status](https://img.shields.io/badge/status-beta-yellow)
![Architecture](https://img.shields.io/badge/architecture-multi--tenant-blue)
![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Supabase%20%7C%20PostgreSQL-0ea5e9)
![License](https://img.shields.io/badge/license-MIT-green)

Sistema completo de fidelização de clientes com **engine avançada de pontos**, projetado para escalar como **SaaS multi-tenant**.

---

## ✨ Sobre o Projeto

O **Fidelidade** é uma plataforma que permite que empresas criem e gerenciem seus próprios programas de fidelidade, com regras altamente configuráveis e um sistema robusto de controle de pontos.

Diferente de soluções simples, o sistema foi construído com foco em:

- precisão de cálculo  
- consistência de dados  
- escalabilidade  
- flexibilidade para diferentes nichos  

---

## 🧠 Diferenciais Técnicos

- 🔥 Cálculo de pontos por item (não apenas total da compra)  
- 🧩 Engine baseada em lotes  
- ⏳ Expiração automática de pontos  
- 🔄 Consumo FIFO real  
- ⚖️ Compensação inteligente em cancelamentos  
- 🏢 Arquitetura multi-tenant nativa  
- 🔐 Segurança via RLS (Row Level Security)  

---

## 🚀 Features

### 👨‍💼 Lojista
- Gestão de clientes  
- Registro de compras com múltiplos itens  
- Cadastro e controle de produtos  
- Configuração de programas de fidelidade  
- Dashboard com métricas  
- Importação de produtos via CSV  

### 👤 Cliente
- Cadastro global  
- Pontos por lojista  
- Participação em múltiplos programas  
- Histórico de pontos  

### ⚙️ Sistema de Pontos

- Baseado em produto + nível  
- Controle por lotes:
  - pendente  
  - disponivel  
  - expirado  
  - cancelado  
- FIFO para consumo  
- Expiração automática  
- Compensação em cancelamentos  

---

## 🧱 Arquitetura

- Frontend (Next.js)
    ↓
- Supabase (Auth + RLS)
    ↓
- PostgreSQL (Funções + Triggers)

---

## 🗃️ Modelagem (Core)

- lojistas
- clientes
- clientes_fidelidade
- produtos
- compras
- compra_itens
- lotes_pontos
- pontos_movimentacoes
- programas_fidelidade
- programa_niveis
- admins_plataforma

---

## 🔄 Fluxo de Pontuação

1. Compra criada  
2. Itens processados individualmente  
3. Sistema calcula pontos  
4. Geração de lotes  
5. Atualização de saldo  
6. Eventos:
   - consumo (FIFO)  
   - expiração  
   - cancelamento com compensação  

---

## 📦 Importação CSV

Formato:
descricao;tetoPercentual;ativo

Fluxo:
Upload → Validação → Deduplicação → Preview → Confirmação


---

## 📊 Dashboard

- Clientes ativos  
- Vendas por período  
- Pontos gerados vs utilizados  
- Distribuição por níveis  
- Top clientes  
- Últimas movimentações  

---

## 🛠️ Stack

### Frontend
- Next.js (App Router)  
- TypeScript  
- Tailwind CSS v4  
- shadcn/ui  

### Backend / Infra
- Supabase (Auth + DB + RLS)  
- PostgreSQL  
- PL/pgSQL  

---

## 🚀 Como rodar o projeto

### 1. Clone

```bash
git clone https://github.com/seu-usuario/fidelidade.git
cd fidelidade

### 2. Instale

```bash
npm install

### 3. Configure variáveis

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
N8N_WEBHOOK_WHATSAPP=

### 4. Rode

```bash
npm run dev