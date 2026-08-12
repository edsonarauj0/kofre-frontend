import { http } from "@/shared/lib/http"
import type { Conta, TipoConta } from "@/shared/types/financeiro"

interface ContaResponseApi {
  id: string
  nome: string
  tipo: Uppercase<TipoConta>
  instituicao: string
  saldoAtual: number
  limiteCredito?: number | null
  diaFechamento?: number | null
  diaVencimento?: number | null
}

interface CriarContaRequest {
  nome: string
  tipo: Uppercase<TipoConta>
  instituicao: string
  saldoAtual: number
  limiteCredito?: number | null
  diaFechamento?: number | null
  diaVencimento?: number | null
}

function normalizarTipoConta(tipo: ContaResponseApi["tipo"]): TipoConta {
  return tipo.toLowerCase() as TipoConta
}

function mapearConta(conta: ContaResponseApi): Conta {
  return {
    id: conta.id,
    nome: conta.nome,
    tipo: normalizarTipoConta(conta.tipo),
    instituicao: conta.instituicao,
    saldoAtual: conta.saldoAtual,
    limiteCredito: conta.limiteCredito ?? null,
    variacaoMensal: 0,
    diaFechamento: conta.diaFechamento ?? null,
    diaVencimento: conta.diaVencimento ?? null,
  }
}

export async function listarContasApi() {
  const { data } = await http.get<ContaResponseApi[]>("/contas")
  return data.map(mapearConta)
}

export async function criarContaApi(payload: CriarContaRequest) {
  const { data } = await http.post<ContaResponseApi>("/contas", payload)
  return mapearConta(data)
}

export async function excluirContaApi(contaId: string) {
  await http.delete(`/contas/${contaId}`)
}

export async function atualizarContaApi(contaId: string, payload: { nome: string; instituicao: string; saldoAtual: number; limiteCredito?: number | null; diaFechamento?: number | null; diaVencimento?: number | null }) {
  const { data } = await http.patch<ContaResponseApi>(`/contas/${contaId}`, payload)
  return mapearConta(data)
}

export async function recalcularSaldoContaApi(contaId: string) {
  const { data } = await http.post<ContaResponseApi>(`/contas/${contaId}/recalcular-saldo`)
  return mapearConta(data)
}
