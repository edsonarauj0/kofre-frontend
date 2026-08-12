const CHAVE_MOEDA = "kofre:preferencias:moeda"
const CHAVE_FUSO = "kofre:preferencias:fuso-horario"

export function obterMoedaPreferida() {
  if (typeof window === "undefined") {
    return "BRL"
  }

  return window.localStorage.getItem(CHAVE_MOEDA) ?? "BRL"
}

export function obterFusoHorarioPreferido() {
  if (typeof window === "undefined") {
    return "America/Sao_Paulo"
  }

  return window.localStorage.getItem(CHAVE_FUSO) ?? "America/Sao_Paulo"
}

export function salvarPreferenciasUsuario(preferencias: {
  moeda: string
  fusoHorario: string
}) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(CHAVE_MOEDA, preferencias.moeda)
  window.localStorage.setItem(CHAVE_FUSO, preferencias.fusoHorario)
}

export function limparPreferenciasUsuario() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(CHAVE_MOEDA)
  window.localStorage.removeItem(CHAVE_FUSO)
}
