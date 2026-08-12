import { http } from "@/shared/lib/http"

export interface TelegramConnectTokenResponse {
  token: string
  expiraEm: string
  comando: string
}

export interface TelegramLinkStatusResponse {
  vinculado: boolean
  sessaoAtiva: boolean
  telegramChatIdMascarado: string | null
  telegramUserIdMascarado: string | null
  sessaoExpiraEm: string | null
  botUsername: string | null
  tokenConexao: TelegramConnectTokenResponse | null
}

export async function gerarTokenTelegramApi(forceNew = false) {
  const { data } = await http.post<TelegramConnectTokenResponse>(
    `/telegram/connect-token${forceNew ? "?forceNew=true" : ""}`
  )
  return data
}

export async function consultarStatusTelegramApi() {
  const { data } = await http.get<TelegramLinkStatusResponse>(
    "/telegram/status"
  )
  return data
}

export async function desvincularTelegramApi() {
  await http.delete("/telegram/link")
}
