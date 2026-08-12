import { dadosIniciais } from "@/shared/lib/dados-mock"
import type {
  AplicacaoFinanceira,
  PerfilFinanceiro,
  SerieMensal,
} from "@/shared/types/financeiro"

function criarSerieMensalZerada(serieBase: SerieMensal[]) {
  return serieBase.map((item) => ({
    mes: item.mes,
    saldo: 0,
    receitas: 0,
    despesas: 0,
  }))
}

export function obterDadosDoPerfilFinanceiro(
  perfilAtivo: PerfilFinanceiro | null,
  nomeUsuario?: string | null,
  emailUsuario?: string | null
): AplicacaoFinanceira {
  const nomeExibicao = perfilAtivo?.nome ?? nomeUsuario ?? dadosIniciais.usuario.nome
  const emailExibicao = emailUsuario ?? dadosIniciais.usuario.email

  if (!perfilAtivo || perfilAtivo.padrao) {
    return {
      ...dadosIniciais,
      usuario: {
        ...dadosIniciais.usuario,
        nome: nomeExibicao,
        email: emailExibicao,
      },
    }
  }

  return {
    usuario: {
      ...dadosIniciais.usuario,
      nome: nomeExibicao,
      email: emailExibicao,
    },
    contas: [],
    cartoes: [],
    transacoes: [],
    orcamentos: [],
    metas: [],
    insights: [],
    saude: {
      pontuacao: 0,
      nivel: "atencao",
      resumo: "Ainda nao existem dados suficientes neste perfil financeiro.",
    },
    serieMensal: criarSerieMensalZerada(dadosIniciais.serieMensal),
    gastosPorCategoria: [],
  }
}
