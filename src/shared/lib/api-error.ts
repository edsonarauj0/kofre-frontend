import axios from "axios"

interface ApiProblemDetail {
  detail?: string
  campos?: Record<string, string>
}

export function extrairMensagemErroApi(
  erro: unknown,
  fallback: string
): string {
  if (!axios.isAxiosError<ApiProblemDetail>(erro)) {
    return fallback
  }

  const detalhe = erro.response?.data?.detail

  if (typeof detalhe === "string" && detalhe.trim().length > 0) {
    return detalhe
  }

  const campos = erro.response?.data?.campos

  if (campos) {
    const primeiraMensagem = Object.values(campos).find(
      (mensagem) => typeof mensagem === "string" && mensagem.trim().length > 0
    )

    if (primeiraMensagem) {
      return primeiraMensagem
    }
  }

  return fallback
}

export function extrairCamposErroApi(
  erro: unknown
): Record<string, string> | undefined {
  if (!axios.isAxiosError<ApiProblemDetail>(erro)) {
    return undefined
  }

  return erro.response?.data?.campos
}
