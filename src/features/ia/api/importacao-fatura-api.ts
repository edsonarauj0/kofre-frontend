import { garantirCsrfCookie, http } from "@/shared/lib/http"

export interface AnaliseFaturaResumoApi {
  totalItens: number
  totalSelecionados: number
  totalCategoriasNovas: number
  totalParceladasBanco: number
  totalParceladasExternas: number
  totalAvista: number
  valorSelecionado: number
  valorIgnorado: number
}

export interface AnaliseFaturaItemApi {
  id: string
  descricao: string
  valor: number
  dataLancamento: string
  dataCompraOriginal: string | null
  categoriaId: string | null
  categoriaNome: string
  categoriaNova: boolean
  grupoCategoria: string
  tipoDespesaCategoria: "FIXA" | "VARIAVEL"
  secaoOrigem: "DESPESAS" | "PARCELAMENTOS"
  tipoParcelamento: "AVISTA" | "PARCELADA_EXTERNA" | "PARCELADA_BANCO"
  parcelaAtual: number | null
  totalParcelas: number | null
  divisoes?: Array<{
    nome?: string
    valor?: number
    percentual?: number
    perfilId?: string | null
  }>
  selecionado: boolean
  observacao: string | null
}

export interface AnaliseFaturaItemIgnoradoApi {
  descricao: string
  valor: number
  secaoOrigem: string
  motivo: string
}

export interface HistoricoImportacaoFaturaApi {
  id: string
  contaId: string
  contaNome: string
  referencia: string
  cartaoFinal: string | null
  nomeArquivo: string
  vencimento: string | null
  totalFatura: number | null
  valorImportadoPdf: number
  totalItensImportados: number
  totalLancamentosGerados: number
  importadoEm: string
  transacoes: HistoricoImportacaoFaturaItemApi[]
}

export interface HistoricoImportacaoFaturaItemApi {
  id: string
  descricao: string
  valor: number
  dataReferencia: string
  parcelaAtual: number | null
  totalParcelas: number | null
}

export interface AnaliseFaturaApi {
  contaId: string
  contaNome: string
  nomeArquivo: string
  referencia: string
  cartaoFinal: string | null
  vencimento: string
  periodoInicio: string | null
  periodoFim: string | null
  totalFatura: number
  totalComprasIdentificadas: number
  provedorCategorizacao: string
  fonteExtracao: "gemini_vision" | "parser_regex"
  resumo: AnaliseFaturaResumoApi
  itens: AnaliseFaturaItemApi[]
  itensIgnorados: AnaliseFaturaItemIgnoradoApi[]
}

export interface ProcessarFaturaRequestApi {
  contaId: string
  referencia: string
  nomeArquivo: string
  cartaoFinal?: string | null
  vencimento: string
  totalFatura: number
  itens: AnaliseFaturaItemApi[]
}

export interface ProcessarFaturaResponseApi {
  contaId: string
  contaNome: string
  referencia: string
  totalProcessado: number
  valorTotalProcessado: number
  categoriasCriadas: number
  categoriasCriadasNomes: string[]
  transacaoIdsCriadas: string[]
}

export async function analisarFaturaCartaoApi(contaId: string, arquivo: File) {
  await garantirCsrfCookie()

  const formData = new FormData()
  formData.append("contaId", contaId)
  formData.append("arquivo", arquivo)

  const { data } = await http.post<AnaliseFaturaApi>("/faturas-cartao/analisar", formData, {
    timeout: 60000,
  })

  return data
}

export async function processarFaturaCartaoApi(payload: ProcessarFaturaRequestApi) {
  await garantirCsrfCookie()

  const { data } = await http.post<ProcessarFaturaResponseApi>("/faturas-cartao/processar", payload, {
    timeout: 60000,
  })

  return data
}

export async function listarHistoricoImportacaoFaturaApi(contaId: string) {
  const { data } = await http.get<HistoricoImportacaoFaturaApi[]>("/faturas-cartao/historico", {
    params: { contaId },
  })

  return data
}
