import { http } from "@/shared/lib/http"
import type { PerfilFinanceiro } from "@/shared/types/financeiro"

interface CriarPerfilFinanceiroRequest {
  nome: string
}

export async function listarPerfisFinanceirosApi() {
  const { data } = await http.get<PerfilFinanceiro[]>("/perfis-financeiros")
  return data
}

export async function criarPerfilFinanceiroApi(payload: CriarPerfilFinanceiroRequest) {
  const { data } = await http.post<PerfilFinanceiro>("/perfis-financeiros", payload)
  return data
}

export async function excluirPerfilFinanceiroApi(perfilId: string) {
  await http.delete(`/perfis-financeiros/${perfilId}`)
}
