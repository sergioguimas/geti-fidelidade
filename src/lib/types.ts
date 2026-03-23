export type UUID = string;
export type CompraStatus = "pendente" | "aprovada" | "recusada" | "cancelada";
export type OrigemCompra = "cliente" | "lojista";

export type ClienteFidelidadeResumo = {
  id: string;
  ativo: boolean;
  streak_atual: number;
  saldo_disponivel: number;
  saldo_pendente: number;
  saldo_negativo: number;
  ultima_compra_valida_em: string | null;
};

export type ClienteListItem = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cnpj: string | null;
  auth_user_id: string | null;
  pode_fazer_login: boolean;
  acesso_ativado_em: string | null;
  ultimo_login_em: string | null;
  created_at: string;
  updated_at: string | null;
  fidelidade: ClienteFidelidadeResumo | null;
};

export type ClienteCreateInput = {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cnpj?: string | null;
  ativo?: boolean;
  podeFazerLogin?: boolean;
};

export type ClienteFormInitialData = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cnpj: string | null;
  ativo: boolean;
  podeFazerLogin: boolean;
} | null;

export type ClienteOption = {
  id: UUID;
  nome: string;
};

export type CompraItemListItem = {
  id: string;
  produto_id: string;
  descricao_produto: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
  percentual_aplicado: number;
  pontos_gerados: number;
};

export type CompraListItem = {
  id: string;
  lojista_id: string;
  cliente_id: string;
  pontos_total: number;
  origem: string | null;
  data_compra: string;
  created_at: string;
  updated_at: string | null;
  clientes: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
  } | null;
  compra_itens: CompraItemListItem[];
};

export type ProdutoOption = {
  id: string;
  descricao: string;
};

export type CompraCreateInput = {
  lojistaId: UUID;
  clienteId: UUID;
  valorTotal: number;
  dataCompra: string;
  origem?: OrigemCompra;
  status?: CompraStatus;
};

export type PremioListItem = {
  id: UUID;
  lojista_id: UUID;
  nome: string;
  descricao: string | null;
  pontos_necessarios: number;
  nivel_minimo_id: UUID | null;
  ativo: boolean;
  created_at: string;
  nivel_minimo?: {
    id: UUID;
    nome: string;
    ordem: number;
  } | null;
};

export type PremioCreateInput = {
  nome: string;
  descricao?: string;
  pontosNecessarios: number;
  nivelMinimoId?: UUID | null;
  ativo?: boolean;
};

export type NivelOption = {
  id: UUID;
  nome: string;
  ordem: number;
};

export type ResgateStatus = "pendente" | "aprovado" | "recusado" | "cancelado";

export type ResgateListItem = {
  id: UUID;
  cliente_id: UUID;
  lojista_id: UUID;
  premio_id: UUID;
  pontos_solicitados: number;
  status: ResgateStatus;
  solicitado_em: string;
  decidido_em: string | null;
  cliente?: {
    id: UUID;
    nome: string;
  } | null;
  premio?: {
    id: UUID;
    nome: string;
  } | null;
};

export type ResgateActionInput = {
  resgateId: UUID;
  status: Extract<ResgateStatus, "aprovado" | "recusado">;
};

export type ClienteUpdateInput = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cnpj?: string | null;
  ativo?: boolean;
  podeFazerLogin?: boolean;
};

export type CompraUpdateInput = {
  id: UUID;
  clienteId: UUID;
  valorTotal: number;
  dataCompra: string;
  status: CompraStatus;
};

export type PremioUpdateInput = {
  id: UUID;
  nome: string;
  descricao?: string;
  pontosNecessarios: number;
  nivelMinimoId?: UUID | null;
  ativo?: boolean;
};

export type DashboardRange = "7d" | "30d" | "90d";

export type DashboardSummary = {
  clientes_total: number;
  clientes_ativos_programa: number;
  compras_periodo: number;
  vendas_periodo: number;
  ticket_medio: number;
  pontos_disponiveis: number;
  resgates_pendentes: number;
  premios_ativos: number;
  taxa_recorrencia: number;
};

export type DashboardTopCliente = {
  cliente_id: string;
  nome: string;
  total_gasto: number;
  compras: number;
};

export type DashboardNivelDistribuicao = {
  nivel: string;
  quantidade: number;
};

export type DashboardSolicitacao = {
  id: string;
  tipo: "resgate";
  cliente_nome: string;
  titulo: string;
  status: string;
  data: string;
};

export type DashboardData = {
  summary: DashboardSummary;
  trends: DashboardTrends;
  top_clientes: DashboardTopCliente[];
  niveis: DashboardNivelDistribuicao[];
  solicitacoes: DashboardSolicitacao[];
};

export type DashboardTrendItem = {
  current: number;
  previous: number;
  change_percent: number | null;
  direction: "up" | "down" | "neutral";
};

export type DashboardTrends = {
  clientes: DashboardTrendItem;
  vendas: DashboardTrendItem;
  pontos: DashboardTrendItem;
  resgates: DashboardTrendItem;
};

export type ProgramaFidelidadeConfig = {
  id: UUID;
  lojista_id: UUID;
  nome: string;
  dias_para_perder_streak: number;
  dias_expiracao_pontos: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProgramaNivelConfig = {
  id: UUID;
  programa_id: UUID;
  nome: string;
  streak_min: number;
  streak_max: number | null;
  percentual_conversao: number;
  teto_pontos_compra: number;
  ordem: number;
  created_at?: string;
};

export type ConfiguracoesData = {
  programa: ProgramaFidelidadeConfig | null;
  niveis: ProgramaNivelConfig[];
};

export type UpdateProgramaInput = {
  id: UUID;
  nome: string;
  dias_para_perder_streak: number;
  dias_expiracao_pontos: number;
  ativo: boolean;
};

export type CreateNivelInput = {
  programaId: UUID;
  nome: string;
  streakMin: number;
  streakMax: number | null;
  percentualConversao: number;
  tetoPontosCompra: number;
  ordem: number;
};

export type UpdateNivelInput = {
  id: UUID;
  nome: string;
  streakMin: number;
  streakMax: number | null;
  percentualConversao: number;
  tetoPontosCompra: number;
  ordem: number;
};