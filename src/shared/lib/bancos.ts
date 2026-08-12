export type BancoOption = {
  id: string
  nome: string
  domain: string
  logoPath: string
  aliases: string[]
  sigla: string
  background: string
  foreground: string
  border: string
}

export const bancosDisponiveis: BancoOption[] = [
  {
    id: "nubank",
    nome: "Nubank",
    domain: "nubank.com.br",
    logoPath: "/bancos/nubank.png",
    aliases: ["nubank", "nu", "nu pagamentos", "nu pagamentos s a"],
    sigla: "NU",
    background: "#F3E8FF",
    foreground: "#7C3AED",
    border: "#DDD6FE",
  },
  {
    id: "inter",
    nome: "Inter",
    domain: "inter.co",
    logoPath: "/bancos/inter.png",
    aliases: ["inter", "banco inter", "inter s a", "banco inter s a"],
    sigla: "IN",
    background: "#FFF1E6",
    foreground: "#F97316",
    border: "#FED7AA",
  },
  {
    id: "itau",
    nome: "Itau",
    domain: "itau.com.br",
    logoPath: "/bancos/itau.png",
    aliases: ["itau", "itaú", "banco itau", "banco itaú"],
    sigla: "IT",
    background: "#FFF4E5",
    foreground: "#EA580C",
    border: "#FDBA74",
  },
  {
    id: "santander",
    nome: "Santander",
    domain: "santander.com.br",
    logoPath: "/bancos/santander.png",
    aliases: ["santander", "banco santander", "santander brasil", "banco santander brasil"],
    sigla: "SA",
    background: "#FFF1F2",
    foreground: "#DC2626",
    border: "#FECACA",
  },
  {
    id: "bradesco",
    nome: "Bradesco",
    domain: "bradesco.com.br",
    logoPath: "/bancos/bradesco.png",
    aliases: ["bradesco", "banco bradesco"],
    sigla: "BR",
    background: "#FFF1F2",
    foreground: "#E11D48",
    border: "#FDA4AF",
  },
  {
    id: "c6",
    nome: "C6 Bank",
    domain: "c6bank.com.br",
    logoPath: "/bancos/c6.png",
    aliases: ["c6", "c6 bank", "c6bank"],
    sigla: "C6",
    background: "#F5F5F5",
    foreground: "#111827",
    border: "#D4D4D8",
  },
  {
    id: "banco-do-brasil",
    nome: "Banco do Brasil",
    domain: "bb.com.br",
    logoPath: "/bancos/banco-do-brasil.png",
    aliases: ["banco do brasil", "bb", "banco brasil"],
    sigla: "BB",
    background: "#FEF3C7",
    foreground: "#1D4ED8",
    border: "#FDE68A",
  },
  {
    id: "caixa",
    nome: "Caixa",
    domain: "caixa.gov.br",
    logoPath: "/bancos/caixa.png",
    aliases: ["caixa", "caixa economica", "caixa econômica", "cef"],
    sigla: "CX",
    background: "#EFF6FF",
    foreground: "#2563EB",
    border: "#BFDBFE",
  },
  {
    id: "xp",
    nome: "XP",
    domain: "xp.com.br",
    logoPath: "/bancos/xp.png",
    aliases: ["xp", "xp investimentos"],
    sigla: "XP",
    background: "#F5F5F5",
    foreground: "#111827",
    border: "#D4D4D8",
  },
  {
    id: "btg",
    nome: "BTG Pactual",
    domain: "btgpactual.com",
    logoPath: "/bancos/btg.png",
    aliases: ["btg", "btg pactual"],
    sigla: "BT",
    background: "#EFF6FF",
    foreground: "#1D4ED8",
    border: "#BFDBFE",
  },
  {
    id: "picpay",
    nome: "PicPay",
    domain: "picpay.com",
    logoPath: "/bancos/picpay.png",
    aliases: ["picpay"],
    sigla: "PP",
    background: "#ECFDF5",
    foreground: "#16A34A",
    border: "#BBF7D0",
  },
  {
    id: "mercado-pago",
    nome: "Mercado Pago",
    domain: "mercadopago.com.br",
    logoPath: "/bancos/mercado-pago.png",
    aliases: ["mercado pago", "mercadopago"],
    sigla: "MP",
    background: "#EFF6FF",
    foreground: "#0284C7",
    border: "#BAE6FD",
  },
  {
    id: "neon",
    nome: "Neon",
    domain: "neon.com.br",
    logoPath: "/bancos/neon.png",
    aliases: ["neon"],
    sigla: "NE",
    background: "#ECFEFF",
    foreground: "#0891B2",
    border: "#A5F3FC",
  },
  {
    id: "sicredi",
    nome: "Sicredi",
    domain: "sicredi.com.br",
    logoPath: "/bancos/sicredi.png",
    aliases: ["sicredi"],
    sigla: "SI",
    background: "#F0FDF4",
    foreground: "#16A34A",
    border: "#BBF7D0",
  },
  {
    id: "sicoob",
    nome: "Sicoob",
    domain: "sicoob.com.br",
    logoPath: "/bancos/sicoob.png",
    aliases: ["sicoob"],
    sigla: "SC",
    background: "#ECFDF5",
    foreground: "#15803D",
    border: "#BBF7D0",
  },
]

function removerAcentos(valor: string) {
  return valor.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

export function normalizarInstituicao(valor?: string | null) {
  return removerAcentos(valor ?? "")
    .toLowerCase()
    .trim()
}

export function obterBancoPorInstituicao(instituicao?: string | null) {
  const normalizado = normalizarInstituicao(instituicao)
  if (!normalizado) {
    return null
  }

  return (
    bancosDisponiveis.find((banco) =>
      banco.aliases.some((alias) => {
        const aliasNormalizado = normalizarInstituicao(alias)
        if (aliasNormalizado === normalizado) {
          return true
        }

        if (aliasNormalizado.length < 3) {
          return false
        }

        return (
          normalizado.includes(aliasNormalizado) || aliasNormalizado.includes(normalizado)
        )
      })
    ) ?? null
  )
}
