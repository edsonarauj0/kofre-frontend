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

  const { data } = await http.post<any>("/faturas-cartao/analisar", formData, {
    timeout: 300000, // 5 minutes
  })

  // Mock mapping to prevent frontend crashes due to backend returning incomplete mock data
  const mappedData: AnaliseFaturaApi = {
    ...data,
    contaId,
    contaNome: data.contaNome || "Conta Desconhecida",
    nomeArquivo: arquivo.name,
    referencia: data.referencia || new Date().toISOString().slice(0, 7), // YYYY-MM
    cartaoFinal: data.cartaoFinal || null,
    vencimento: data.vencimento || new Date().toISOString().slice(0, 10),
    periodoInicio: data.periodoInicio || null,
    periodoFim: data.periodoFim || null,
    totalFatura: data.totalFatura || data.total || 0,
    totalComprasIdentificadas: data.totalComprasIdentificadas || data.total || 0,
    provedorCategorizacao: data.provedorCategorizacao || "gemini",
    fonteExtracao: data.fonteExtracao || "gemini_vision",
    resumo: data.resumo || {
      totalItens: data.itens?.length || 0,
      totalSelecionados: data.itens?.length || 0,
      totalCategoriasNovas: 0,
      totalParceladasBanco: 0,
      totalParceladasExternas: 0,
      totalAvista: data.itens?.length || 0,
      valorSelecionado: data.total || 0,
      valorIgnorado: 0,
    },
    itens: (data.itens || []).map((item: any, i: number) => ({
      ...item,
      id: item.id || `mock-id-${i}`,
      descricao: item.descricao || "Item sem descrição",
      valor: item.valor || 0,
      dataLancamento: item.dataLancamento || item.data || new Date().toISOString().slice(0, 10),
      dataCompraOriginal: item.dataCompraOriginal || item.data || null,
      categoriaId: item.categoriaId || null,
      categoriaNome: item.categoriaNome || "",
      categoriaNova: !!item.categoriaNova,
      grupoCategoria: item.grupoCategoria || "Outros",
      tipoDespesaCategoria: item.tipoDespesaCategoria || "VARIAVEL",
      secaoOrigem: item.secaoOrigem || "DESPESAS",
      tipoParcelamento: item.tipoParcelamento || "AVISTA",
      parcelaAtual: item.parcelaAtual || null,
      totalParcelas: item.totalParcelas || null,
      selecionado: item.selecionado !== undefined ? item.selecionado : true,
      observacao: item.observacao || null,
    })),
    itensIgnorados: data.itensIgnorados || [],
  }

  return mappedData
}

export async function processarFaturaCartaoApi(payload: ProcessarFaturaRequestApi) {
  await garantirCsrfCookie()

  const { data } = await http.post<ProcessarFaturaResponseApi>("/faturas-cartao/processar", payload, {
    timeout: 300000, // 5 minutes
  })

  return data
}

export async function listarHistoricoImportacaoFaturaApi(contaId: string) {
  const { data } = await http.get<any[]>("/faturas-cartao/historico", {
    params: { contaId },
  })

  return data.map((item) => ({
    id: item.id,
    contaId: item.contaId,
    contaNome: item.contaNome || "Conta Desconhecida",
    referencia: item.referencia || "00/0000",
    cartaoFinal: item.cartaoFinal || null,
    nomeArquivo: item.arquivo || item.nomeArquivo || "Fatura Importada",
    vencimento: item.vencimento || null,
    totalFatura: item.totalFatura || null,
    valorImportadoPdf: item.valorImportadoPdf || 0,
    totalItensImportados: item.totalItensImportados || item.totalTransacoes || 0,
    totalLancamentosGerados: item.totalTransacoes || 0,
    importadoEm: item.data || item.importadoEm || new Date().toISOString(),
    transacoes: item.transacoes || [],
  })) as HistoricoImportacaoFaturaApi[]
}
