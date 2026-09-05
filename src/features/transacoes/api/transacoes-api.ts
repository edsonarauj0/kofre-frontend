import { http } from "@/shared/lib/http"
import type { TipoTransacao, Transacao, StatusPagamentoTransacao } from "@/shared/types/financeiro"

export interface CategoriaApi {
  id: string
  nome: string
  cor: string
  icone: string
  tipo: "DESPESA" | "RECEITA" | "TRANSFERENCIA" | "INVESTIMENTO"
  grupo: string
  ocultarRelatorios: boolean
  tipoDespesa: "FIXA" | "VARIAVEL" | null
}

interface TransacaoResponseApi {
  id: string
  descricao: string
  tipo: Uppercase<TipoTransacao>
  valor: number
  valorOriginal?: number | null
  dataLancamento: string
  observacao?: string | null
  meioPagamento?: string | null
  contaId: string
  categoriaId: string
  compartilhada?: boolean
  grupoCompartilhamentoId?: string | null
  parcelada?: boolean
  parcelaNumero?: number | null
  parcelaTotal?: number | null
  grupoParcelamentoId?: string | null
  divisoes?: Array<{
    id: string
    nome: string
    valor: number
    perfilId?: string | null
    perfilNome?: string | null
  }>
}

interface CriarCategoriaRequest {
  nome: string
  cor: string
  icone: string
  tipo?: CategoriaApi["tipo"]
  grupo?: string
  ocultarRelatorios?: boolean
  tipoDespesa?: Exclude<CategoriaApi["tipoDespesa"], null>
}

interface CriarTransacaoRequest {
  descricao: string
  tipo: Uppercase<TipoTransacao>
  valor: number
  dataLancamento: string
  observacao?: string
  meioPagamento?: string | null
  contaId: string
  categoriaId: string
  statusPagamento?: string | null
  dataVencimento?: string | null
  diaRecorrenciaMensal?: number | null
  dataAgendamentoPagamento?: string | null
  dataPagamento?: string | null
  contaPagamentoId?: string | null
  recorrente?: boolean
  quantidadeParcelas?: number | null
  divisoes?: Array<{
    nome?: string
    valor: number
    perfilId?: string
  }> | null
}

function mapearTransacao(
  transacao: TransacaoResponseApi,
  categorias: CategoriaApi[],
  contas: { id: string; nome: string; tipo?: string; instituicao?: string }[]
): Transacao {
  const categoria = categorias.find((item) => item.id === transacao.categoriaId)
  const conta = contas.find((item) => item.id === transacao.contaId)

  return {
    id: transacao.id,
    descricao: transacao.descricao,
    categoria: categoria?.nome ?? "Sem categoria",
    subcategoria: categoria?.nome ?? "Sem categoria",
    valor: transacao.valor,
    tipo: transacao.tipo.toLowerCase() as TipoTransacao,
    conta: conta?.nome ?? "Conta",
    tag: "api",
    data: transacao.dataLancamento,
    observacao: transacao.observacao,
    recorrente: false,
    contaId: transacao.contaId,
    contaTipo: conta?.tipo as Transacao["contaTipo"],
    contaInstituicao: conta?.instituicao,
    categoriaId: transacao.categoriaId,
    categoriaTipo: categoria?.tipo,
    categoriaGrupo: categoria?.grupo,
    valorOriginal: transacao.valorOriginal ?? null,
    meioPagamento: (transacao.meioPagamento ?? null) as Transacao["meioPagamento"],
    compartilhada: transacao.compartilhada ?? false,
    grupoCompartilhamentoId: transacao.grupoCompartilhamentoId ?? null,
    parcelada: transacao.parcelada ?? false,
    parcelaNumero: transacao.parcelaNumero ?? null,
    parcelaTotal: transacao.parcelaTotal ?? null,
    grupoParcelamentoId: transacao.grupoParcelamentoId ?? null,
    divisoes:
      transacao.divisoes?.map((divisao) => ({
        id: divisao.id,
        nome: divisao.nome,
        valor: divisao.valor,
        perfilId: divisao.perfilId ?? null,
        perfilNome: divisao.perfilNome ?? null,
      })) ?? [],
  }
}

export async function listarCategoriasApi() {
  const { data } = await http.get<CategoriaApi[]>("/categorias")
  return data
}

export async function criarCategoriaApi(payload: CriarCategoriaRequest) {
  const { data } = await http.post<CategoriaApi>("/categorias", payload)
  return data
}

export async function atualizarCategoriaApi(categoriaId: string, payload: CriarCategoriaRequest) {
  const { data } = await http.put<CategoriaApi>(`/categorias/${categoriaId}`, payload)
  return data
}

export async function excluirCategoriaApi(categoriaId: string) {
  await http.delete(`/categorias/${categoriaId}`)
}

export async function renomearGrupoCategoriaApi(grupoAtual: string, grupo: string) {
  const { data } = await http.put<CategoriaApi[]>(
    `/categorias/grupos/${encodeURIComponent(grupoAtual)}`,
    { grupo }
  )
  return data
}

export async function atualizarVisibilidadeGrupoCategoriaApi(
  grupoAtual: string,
  ocultarRelatorios: boolean
) {
  const { data } = await http.patch<CategoriaApi[]>(
    `/categorias/grupos/${encodeURIComponent(grupoAtual)}/ocultar-relatorios`,
    { ocultarRelatorios }
  )
  return data
}

export async function excluirGrupoCategoriaApi(grupoAtual: string) {
  await http.delete(`/categorias/grupos/${encodeURIComponent(grupoAtual)}`)
}

export const TRANSACOES_CACHE_KEY = "@kofre/transacoes_cache"

export function limparCacheTransacoes() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TRANSACOES_CACHE_KEY)
  }
}

export async function listarTransacoesApi(
  categorias: CategoriaApi[],
  contas: { id: string; nome: string; tipo?: string; instituicao?: string }[]
) {
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(TRANSACOES_CACHE_KEY)
    if (cached) {
      try {
        const data = JSON.parse(cached) as TransacaoResponseApi[]
        return data.map((item) => mapearTransacao(item, categorias, contas))
      } catch (e) {
        console.error("Falha ao ler cache", e)
      }
    }
  }

  const { data } = await http.get<TransacaoResponseApi[]>("/transacoes")
  
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(TRANSACOES_CACHE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn("Falha ao salvar cache (espaço?)", e)
    }
  }
  
  return data.map((item) => mapearTransacao(item, categorias, contas))
}

export async function criarTransacaoApi(payload: CriarTransacaoRequest) {
  const { data } = await http.post<TransacaoResponseApi>("/transacoes", payload)
  limparCacheTransacoes()
  return data
}

export async function atualizarTransacaoApi(
  transacaoId: string,
  payload: CriarTransacaoRequest
) {
  const { data } = await http.put<TransacaoResponseApi>(`/transacoes/${transacaoId}`, payload)
  limparCacheTransacoes()
  return data
}

export async function excluirTransacaoApi(transacaoId: string) {
  await http.delete(`/transacoes/${transacaoId}`)
  limparCacheTransacoes()
}

export async function atualizarStatusPagamentoTransacaoApi(
  transacaoId: string,
  payload: {
    statusPagamento: StatusPagamentoTransacao
    dataAgendamentoPagamento?: string | null
    dataPagamento?: string | null
    contaPagamentoId?: string | null
  }
) {
  const { data } = await http.patch<TransacaoResponseApi>(`/transacoes/${transacaoId}/status-pagamento`, payload)
  limparCacheTransacoes()
  return data
}
