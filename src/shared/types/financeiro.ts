export type TipoTransacao = "receita" | "despesa" | "transferencia"
export type TipoConta =
  | "corrente"
  | "poupanca"
  | "investimento"
  | "carteira"
  | "cartao_credito"
  | "cripto"

export type MeioPagamento = "DEBITO" | "CREDITO" | "BOLETO" | "PIX"
export type StatusPagamentoTransacao = "PENDENTE" | "AGENDADO" | "PAGO"

export type StatusMeta = "no-prazo" | "atencao" | "concluida"

export type NivelSaude = "excelente" | "boa" | "atencao"

export interface Usuario {
  nome: string
  email: string
  avatar: string
  moeda: string
  fusoHorario: string
}

export interface PerfilFinanceiro {
  id: string
  nome: string
  padrao: boolean
}

export interface Conta {
  id: string
  nome: string
  tipo: TipoConta
  instituicao: string
  saldoAtual: number
  limiteCredito?: number | null
  variacaoMensal: number
  diaFechamento?: number | null
  diaVencimento?: number | null
}

export interface Cartao {
  id: string
  nome: string
  bandeira: string
  limite: number
  faturaAtual: number
  vencimento: string
}

export interface Transacao {
  id: string
  descricao: string
  categoria: string
  subcategoria: string
  valor: number
  tipo: TipoTransacao
  conta: string
  tag: string
  data: string
  recorrente: boolean
  observacao?: string | null
  contaId?: string
  contaTipo?: TipoConta
  contaInstituicao?: string
  categoriaId?: string
  categoriaTipo?: "DESPESA" | "RECEITA" | "TRANSFERENCIA" | "INVESTIMENTO"
  categoriaGrupo?: string
  valorOriginal?: number | null
  meioPagamento?: MeioPagamento | null
  statusPagamento?: StatusPagamentoTransacao | null
  dataVencimento?: string | null
  diaRecorrenciaMensal?: number | null
  dataAgendamentoPagamento?: string | null
  dataPagamento?: string | null
  compartilhada?: boolean
  contaPagamentoId?: string | null
  grupoCompartilhamentoId?: string | null
  parcelada?: boolean
  parcelaNumero?: number | null
  parcelaTotal?: number | null
  grupoParcelamentoId?: string | null
  divisoes?: Array<{
    id: string
    nome: string
    valor: number
    percentual?: number | null
    perfilId?: string | null
    perfilNome?: string | null
  }>
}

export interface Orcamento {
  id: string
  categoria: string
  planejado: number
  realizado: number
  alerta: 50 | 80 | 100
}

export interface MetaFinanceira {
  id: string
  nome: string
  valorAlvo: number
  valorAtual: number
  prazo: string
  contribuicaoMensal: number
  conta: string
  status: StatusMeta
}

export interface InsightIA {
  titulo: string
  descricao: string
  impacto: "economia" | "alerta" | "oportunidade"
}

export interface SaudeFinanceira {
  pontuacao: number
  nivel: NivelSaude
  resumo: string
}

export interface SerieMensal {
  mes: string
  saldo: number
  receitas: number
  despesas: number
}

export interface GastoCategoria {
  categoria: string
  valor: number
  percentual: number
}

export interface AplicacaoFinanceira {
  usuario: Usuario
  contas: Conta[]
  cartoes: Cartao[]
  transacoes: Transacao[]
  orcamentos: Orcamento[]
  metas: MetaFinanceira[]
  insights: InsightIA[]
  saude: SaudeFinanceira
  serieMensal: SerieMensal[]
  gastosPorCategoria: GastoCategoria[]
}
