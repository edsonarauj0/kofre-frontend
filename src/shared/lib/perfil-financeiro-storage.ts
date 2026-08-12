const CHAVE_PERFIL_FINANCEIRO_ATIVO = "kofre.perfilFinanceiroAtivoId"

export function obterPerfilFinanceiroAtivoId() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(CHAVE_PERFIL_FINANCEIRO_ATIVO)
}

export function salvarPerfilFinanceiroAtivoId(perfilId: string) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(CHAVE_PERFIL_FINANCEIRO_ATIVO, perfilId)
}

export function limparPerfilFinanceiroAtivoId() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(CHAVE_PERFIL_FINANCEIRO_ATIVO)
}
