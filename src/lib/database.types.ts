export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins_plataforma: {
        Row: {
          ativo: boolean
          auth_user_id: string
          created_at: string
          email: string
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ajustes_pontos: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          descricao: string | null
          id: string
          lojista_id: string | null
          pontos: number
          referencia_compra: string | null
          tipo: Database["public"]["Enums"]["ajuste_tipo"]
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          lojista_id?: string | null
          pontos: number
          referencia_compra?: string | null
          tipo: Database["public"]["Enums"]["ajuste_tipo"]
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          lojista_id?: string | null
          pontos?: number
          referencia_compra?: string | null
          tipo?: Database["public"]["Enums"]["ajuste_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_pontos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_pontos_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          acesso_ativado_em: string | null
          ativo: boolean
          auth_user_id: string | null
          cnpj: string | null
          codigo_externo: string | null
          created_at: string | null
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          lojista_id: string | null
          nome: string
          pode_fazer_login: boolean
          telefone: string | null
          ultimo_login_em: string | null
          updated_at: string | null
        }
        Insert: {
          acesso_ativado_em?: string | null
          ativo?: boolean
          auth_user_id?: string | null
          cnpj?: string | null
          codigo_externo?: string | null
          created_at?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          lojista_id?: string | null
          nome: string
          pode_fazer_login?: boolean
          telefone?: string | null
          ultimo_login_em?: string | null
          updated_at?: string | null
        }
        Update: {
          acesso_ativado_em?: string | null
          ativo?: boolean
          auth_user_id?: string | null
          cnpj?: string | null
          codigo_externo?: string | null
          created_at?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          lojista_id?: string | null
          nome?: string
          pode_fazer_login?: boolean
          telefone?: string | null
          ultimo_login_em?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_fidelidade: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          id: string
          lojista_id: string | null
          nivel_atual_id: string | null
          programa_id: string | null
          saldo_disponivel: number | null
          saldo_negativo: number | null
          saldo_pendente: number | null
          streak_atual: number | null
          ultima_compra_valida_em: string | null
          updated_at: string | null
          validade_dias_custom: number | null
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          id?: string
          lojista_id?: string | null
          nivel_atual_id?: string | null
          programa_id?: string | null
          saldo_disponivel?: number | null
          saldo_negativo?: number | null
          saldo_pendente?: number | null
          streak_atual?: number | null
          ultima_compra_valida_em?: string | null
          updated_at?: string | null
          validade_dias_custom?: number | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          id?: string
          lojista_id?: string | null
          nivel_atual_id?: string | null
          programa_id?: string | null
          saldo_disponivel?: number | null
          saldo_negativo?: number | null
          saldo_pendente?: number | null
          streak_atual?: number | null
          ultima_compra_valida_em?: string | null
          updated_at?: string | null
          validade_dias_custom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_fidelidade_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_fidelidade_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_fidelidade_nivel_atual_id_fkey"
            columns: ["nivel_atual_id"]
            isOneToOne: false
            referencedRelation: "programa_niveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_fidelidade_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas_fidelidade"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_usuarios: {
        Row: {
          auth_user_id: string
          cliente_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          cliente_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          cliente_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_usuarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_itens: {
        Row: {
          compra_id: string
          created_at: string
          desconto: number
          descricao_produto: string
          id: string
          percentual_aplicado: number
          pontos_gerados: number
          produto_id: string
          quantidade: number
          subtotal: number
          subtotal_bruto: number
          teto_percentual_nivel: number
          teto_percentual_produto: number
          valor_unitario: number
        }
        Insert: {
          compra_id: string
          created_at?: string
          desconto?: number
          descricao_produto: string
          id?: string
          percentual_aplicado: number
          pontos_gerados: number
          produto_id: string
          quantidade: number
          subtotal: number
          subtotal_bruto: number
          teto_percentual_nivel: number
          teto_percentual_produto: number
          valor_unitario: number
        }
        Update: {
          compra_id?: string
          created_at?: string
          desconto?: number
          descricao_produto?: string
          id?: string
          percentual_aplicado?: number
          pontos_gerados?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          subtotal_bruto?: number
          teto_percentual_nivel?: number
          teto_percentual_produto?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "compra_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data_compra: string
          desconto_total: number
          id: string
          lojista_id: string | null
          origem: Database["public"]["Enums"]["origem_compra"]
          pontos_total: number
          status: Database["public"]["Enums"]["compra_status"] | null
          subtotal_bruto: number
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data_compra: string
          desconto_total?: number
          id?: string
          lojista_id?: string | null
          origem: Database["public"]["Enums"]["origem_compra"]
          pontos_total?: number
          status?: Database["public"]["Enums"]["compra_status"] | null
          subtotal_bruto?: number
          updated_at?: string
          valor_total: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data_compra?: string
          desconto_total?: number
          id?: string
          lojista_id?: string | null
          origem?: Database["public"]["Enums"]["origem_compra"]
          pontos_total?: number
          status?: Database["public"]["Enums"]["compra_status"] | null
          subtotal_bruto?: number
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojistas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string
          nome_responsavel: string | null
          razao_social: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia: string
          nome_responsavel?: string | null
          razao_social: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string
          nome_responsavel?: string | null
          razao_social?: string
          telefone?: string | null
        }
        Relationships: []
      }
      lojistas_usuarios: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          lojista_id: string
          papel: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          lojista_id: string
          papel?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          lojista_id?: string
          papel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojistas_usuarios_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_pontos: {
        Row: {
          cliente_id: string
          compra_id: string
          created_at: string
          expira_em: string | null
          gerado_em: string
          id: string
          lojista_id: string
          nivel_id: string | null
          percentual_aplicado: number
          pontos_cancelados: number | null
          pontos_disponiveis: number
          pontos_expirados: number | null
          pontos_gastos: number | null
          pontos_gerados: number
          pontos_pendentes: number | null
          status: Database["public"]["Enums"]["lote_status"]
          teto_aplicado: number
        }
        Insert: {
          cliente_id: string
          compra_id: string
          created_at?: string
          expira_em?: string | null
          gerado_em?: string
          id?: string
          lojista_id: string
          nivel_id?: string | null
          percentual_aplicado: number
          pontos_cancelados?: number | null
          pontos_disponiveis: number
          pontos_expirados?: number | null
          pontos_gastos?: number | null
          pontos_gerados: number
          pontos_pendentes?: number | null
          status?: Database["public"]["Enums"]["lote_status"]
          teto_aplicado: number
        }
        Update: {
          cliente_id?: string
          compra_id?: string
          created_at?: string
          expira_em?: string | null
          gerado_em?: string
          id?: string
          lojista_id?: string
          nivel_id?: string | null
          percentual_aplicado?: number
          pontos_cancelados?: number | null
          pontos_disponiveis?: number
          pontos_expirados?: number | null
          pontos_gastos?: number | null
          pontos_gerados?: number
          pontos_pendentes?: number | null
          status?: Database["public"]["Enums"]["lote_status"]
          teto_aplicado?: number
        }
        Relationships: [
          {
            foreignKeyName: "lotes_pontos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_pontos_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_pontos_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_pontos_nivel_id_fkey"
            columns: ["nivel_id"]
            isOneToOne: false
            referencedRelation: "programa_niveis"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_movimentacoes: {
        Row: {
          cliente_id: string
          compra_id: string | null
          created_at: string
          descricao: string | null
          id: string
          lojista_id: string
          lote_destino_id: string | null
          lote_id: string | null
          lote_origem_id: string | null
          metadata: Json
          pontos: number
          saldo_resultante: number | null
          sinal: number
          tipo: Database["public"]["Enums"]["pontos_movimentacao_tipo"]
          updated_at: string
        }
        Insert: {
          cliente_id: string
          compra_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lojista_id: string
          lote_destino_id?: string | null
          lote_id?: string | null
          lote_origem_id?: string | null
          metadata?: Json
          pontos: number
          saldo_resultante?: number | null
          sinal?: number
          tipo: Database["public"]["Enums"]["pontos_movimentacao_tipo"]
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          compra_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lojista_id?: string
          lote_destino_id?: string | null
          lote_id?: string | null
          lote_origem_id?: string | null
          metadata?: Json
          pontos?: number
          saldo_resultante?: number | null
          sinal?: number
          tipo?: Database["public"]["Enums"]["pontos_movimentacao_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_movimentacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_movimentacoes_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_movimentacoes_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_movimentacoes_lote_destino_id_fkey"
            columns: ["lote_destino_id"]
            isOneToOne: false
            referencedRelation: "lotes_pontos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_movimentacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_pontos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_movimentacoes_lote_origem_id_fkey"
            columns: ["lote_origem_id"]
            isOneToOne: false
            referencedRelation: "lotes_pontos"
            referencedColumns: ["id"]
          },
        ]
      }
      premios: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          lojista_id: string | null
          nivel_minimo_id: string | null
          nome: string
          pontos_necessarios: number
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          lojista_id?: string | null
          nivel_minimo_id?: string | null
          nome: string
          pontos_necessarios: number
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          lojista_id?: string | null
          nivel_minimo_id?: string | null
          nome?: string
          pontos_necessarios?: number
        }
        Relationships: [
          {
            foreignKeyName: "premios_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premios_nivel_minimo_id_fkey"
            columns: ["nivel_minimo_id"]
            isOneToOne: false
            referencedRelation: "programa_niveis"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          lojista_id: string
          teto_percentual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
          lojista_id: string
          teto_percentual: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          lojista_id?: string
          teto_percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_niveis: {
        Row: {
          id: string
          nome: string | null
          ordem: number
          percentual_conversao: number
          programa_id: string | null
          streak_max: number | null
          streak_min: number
          teto_pontos_compra: number
        }
        Insert: {
          id?: string
          nome?: string | null
          ordem: number
          percentual_conversao: number
          programa_id?: string | null
          streak_max?: number | null
          streak_min: number
          teto_pontos_compra: number
        }
        Update: {
          id?: string
          nome?: string | null
          ordem?: number
          percentual_conversao?: number
          programa_id?: string | null
          streak_max?: number | null
          streak_min?: number
          teto_pontos_compra?: number
        }
        Relationships: [
          {
            foreignKeyName: "programa_niveis_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas_fidelidade"
            referencedColumns: ["id"]
          },
        ]
      }
      programas_fidelidade: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dias_expiracao_pontos: number | null
          dias_para_perder_streak: number | null
          id: string
          lojista_id: string | null
          nome: string
          updated_at: string
          validade_dias: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dias_expiracao_pontos?: number | null
          dias_para_perder_streak?: number | null
          id?: string
          lojista_id?: string | null
          nome: string
          updated_at?: string
          validade_dias?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dias_expiracao_pontos?: number | null
          dias_para_perder_streak?: number | null
          id?: string
          lojista_id?: string | null
          nome?: string
          updated_at?: string
          validade_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "programas_fidelidade_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      resgate_alocacoes: {
        Row: {
          created_at: string | null
          id: string
          lote_id: string | null
          pontos_alocados: number
          resgate_id: string | null
          status: Database["public"]["Enums"]["alocacao_status"] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lote_id?: string | null
          pontos_alocados: number
          resgate_id?: string | null
          status?: Database["public"]["Enums"]["alocacao_status"] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lote_id?: string | null
          pontos_alocados?: number
          resgate_id?: string | null
          status?: Database["public"]["Enums"]["alocacao_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "resgate_alocacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_pontos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgate_alocacoes_resgate_id_fkey"
            columns: ["resgate_id"]
            isOneToOne: false
            referencedRelation: "resgates"
            referencedColumns: ["id"]
          },
        ]
      }
      resgates: {
        Row: {
          cliente_id: string | null
          decidido_em: string | null
          id: string
          lojista_id: string | null
          pontos_solicitados: number
          premio_id: string | null
          solicitado_em: string | null
          status: Database["public"]["Enums"]["resgate_status"] | null
        }
        Insert: {
          cliente_id?: string | null
          decidido_em?: string | null
          id?: string
          lojista_id?: string | null
          pontos_solicitados: number
          premio_id?: string | null
          solicitado_em?: string | null
          status?: Database["public"]["Enums"]["resgate_status"] | null
        }
        Update: {
          cliente_id?: string | null
          decidido_em?: string | null
          id?: string
          lojista_id?: string | null
          pontos_solicitados?: number
          premio_id?: string | null
          solicitado_em?: string | null
          status?: Database["public"]["Enums"]["resgate_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "resgates_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgates_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgates_premio_id_fkey"
            columns: ["premio_id"]
            isOneToOne: false
            referencedRelation: "premios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_alocar_fifo_resgate: {
        Args: { p_resgate_id: string }
        Returns: undefined
      }
      fn_calcular_streak_cliente: {
        Args: {
          p_cliente_id: string
          p_data_compra: string
          p_lojista_id: string
        }
        Returns: number
      }
      fn_cancelar_compra_com_compensacao: {
        Args: { p_compra_id: string }
        Returns: undefined
      }
      fn_expirar_lotes: { Args: never; Returns: number }
      fn_garantir_cliente_fidelidade: {
        Args: { p_cliente_id: string; p_lojista_id: string }
        Returns: undefined
      }
      fn_nivel_por_streak: {
        Args: { p_programa_id: string; p_streak: number }
        Returns: {
          id: string
          nome: string | null
          ordem: number
          percentual_conversao: number
          programa_id: string | null
          streak_max: number | null
          streak_min: number
          teto_pontos_compra: number
        }
        SetofOptions: {
          from: "*"
          to: "programa_niveis"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_prever_cancelamento_compra: {
        Args: { p_compra_id: string }
        Returns: Json
      }
      fn_processar_compra: { Args: { p_compra_id: string }; Returns: undefined }
      fn_processar_status_resgate: {
        Args: {
          p_novo_status: Database["public"]["Enums"]["resgate_status"]
          p_resgate_id: string
        }
        Returns: undefined
      }
      fn_programa_ativo: { Args: { p_lojista_id: string }; Returns: string }
      fn_rebuild_cliente_fidelidade: {
        Args: { p_cliente_id: string; p_lojista_id: string }
        Returns: undefined
      }
      fn_registrar_movimentacao_pontos: {
        Args: {
          p_cliente_id: string
          p_compra_id?: string
          p_descricao?: string
          p_lojista_id: string
          p_lote_destino_id?: string
          p_lote_id?: string
          p_lote_origem_id?: string
          p_metadata?: Json
          p_pontos: number
          p_saldo_resultante?: number
          p_sinal?: number
          p_tipo: Database["public"]["Enums"]["pontos_movimentacao_tipo"]
        }
        Returns: {
          cliente_id: string
          compra_id: string | null
          created_at: string
          descricao: string | null
          id: string
          lojista_id: string
          lote_destino_id: string | null
          lote_id: string | null
          lote_origem_id: string | null
          metadata: Json
          pontos: number
          saldo_resultante: number | null
          sinal: number
          tipo: Database["public"]["Enums"]["pontos_movimentacao_tipo"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pontos_movimentacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ajuste_tipo:
        | "compensacao_cancelamento"
        | "saldo_negativo"
        | "ajuste_manual"
      alocacao_status: "pendente" | "gasto" | "revertido"
      compra_status: "pendente" | "aprovada" | "recusada" | "cancelada"
      lote_status: "pendente" | "disponivel" | "cancelado" | "expirado"
      origem_compra: "cliente" | "lojista"
      pontos_movimentacao_tipo:
        | "geracao"
        | "resgate"
        | "compensacao_cancelamento"
        | "expiracao"
        | "ajuste_manual"
        | "saldo_negativo"
      resgate_status: "pendente" | "aprovado" | "recusado" | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ajuste_tipo: [
        "compensacao_cancelamento",
        "saldo_negativo",
        "ajuste_manual",
      ],
      alocacao_status: ["pendente", "gasto", "revertido"],
      compra_status: ["pendente", "aprovada", "recusada", "cancelada"],
      lote_status: ["pendente", "disponivel", "cancelado", "expirado"],
      origem_compra: ["cliente", "lojista"],
      pontos_movimentacao_tipo: [
        "geracao",
        "resgate",
        "compensacao_cancelamento",
        "expiracao",
        "ajuste_manual",
        "saldo_negativo",
      ],
      resgate_status: ["pendente", "aprovado", "recusado", "cancelado"],
    },
  },
} as const
