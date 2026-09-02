import { obterMoedaPreferida } from "@/shared/lib/preferencias-usuario"

const localePorMoeda: Record<string, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  ARS: "es-AR",
}

export function formatarMoeda(valor: number, moeda = obterMoedaPreferida()) {
  return new Intl.NumberFormat(localePorMoeda[moeda] ?? "pt-BR", {
    style: "currency",
    currency: moeda,
    maximumFractionDigits: 2,
  }).format(valor)
}

export function parseValorDigitado(valor?: string | number | null) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : Number.NaN
  }

  const texto = String(valor ?? "").trim()
  if (!texto) {
    return Number.NaN
  }

  const negativo = texto.startsWith("-")
  const semSinal = negativo ? texto.slice(1) : texto

  // Suporta formatos como 1.002,20, 1002,20 e 1002.20.
  const normalizado = semSinal.includes(",")
    ? semSinal.replace(/\./g, "").replace(",", ".")
    : semSinal

  const numero = Number(normalizado)
  if (!Number.isFinite(numero)) {
    return Number.NaN
  }

  return negativo ? -numero : numero
}

export function formatarValorParaInput(valor?: string | number | null) {
  const numero = parseValorDigitado(valor)
  if (!Number.isFinite(numero)) {
    return ""
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

export function mascararValorMonetarioDigitado(
  valor: string,
  { allowNegative = false }: { allowNegative?: boolean } = {}
) {
  const texto = String(valor ?? "")
  const negativo = allowNegative && texto.includes("-")
  const digitos = texto.replace(/\D/g, "")

  if (!digitos) {
    return ""
  }

  const numero = Number(digitos) / 100
  const formatado = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)

  return negativo ? `-${formatado}` : formatado
}

export function formatarNumeroDecimalFormulario(valor: number, casas = 2) {
  return valor.toFixed(casas)
}

export function obterSimboloMoeda(moeda = obterMoedaPreferida()) {
  return new Intl.NumberFormat(localePorMoeda[moeda] ?? "pt-BR", {
    style: "currency",
    currency: moeda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .formatToParts(0)
    .find((parte) => parte.type === "currency")?.value ?? moeda
}

export function formatarPercentual(valor: number) {
  return `${valor >= 0 ? "+" : ""}${valor.toFixed(1)}%`
}

export function formatarData(valor?: string | null) {
  if (!valor) return "";
  const date = new Date(valor);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function obterIniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("")
}
