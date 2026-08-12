import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  IconAlertTriangle,
  IconCalendarMonth,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCreditCard,
  IconListDetails,
  IconReceipt2,
  IconRepeat,
} from "@tabler/icons-react"

import { useAuth } from "@/app/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { listarContasApi } from "@/features/contas/api/contas-api"
import {
  listarHistoricoImportacaoFaturaApi,
  type HistoricoImportacaoFaturaApi,
} from "@/features/ia/api/importacao-fatura-api"
import {
  atualizarStatusPagamentoTransacaoApi,
  listarCategoriasApi,
  listarTransacoesApi,
} from "@/features/transacoes/api/transacoes-api"
import { cn } from "@/lib/utils"
import { LogoBanco } from "@/shared/components/logo-banco"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"
import { formatarData, formatarMoeda } from "@/shared/lib/formatadores"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Conta, Transacao } from "@/shared/types/financeiro"

type VisualizacaoAgenda = "CALENDARIO" | "LISTA"
type ModoAgenda = "VENCIMENTO" | "PAGAMENTO"
type FiltroAgenda = "TODOS" | "FIXAS" | "FATURAS" | "PENDENTES" | "AGENDADOS" | "PAGOS" | "VENCIDOS"

type AgendaItem = {
  id: string
  titulo: string
  descricao: string
  valor: number
  valorTransacoes: number
  valorFaturaImportada: number | null
  dataPrincipal: string
  dataVencimento: string | null
  dataPagamento: string | null
  dataAgendamentoPagamento: string | null
  statusPagamento: NonNullable<Transacao["statusPagamento"]>
  origem: "despesa" | "fatura_cartao"
  contaNome: string
  contaInstituicao?: string
  contaPagamentoNome?: string | null
  recorrente: boolean
  parcelada: boolean
  rota: string
  vencida: boolean
  transacaoIds: string[]
}

function obterDataLocal(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

function normalizarIso(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function obterHojeIsoLocal() {
  return normalizarIso(new Date())
}

function inicioDoMes(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), 1)
}

function fimDoMes(data: Date) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0)
}

function adicionarDias(data: Date, quantidade: number) {
  const copia = new Date(data)
  copia.setDate(copia.getDate() + quantidade)
  return copia
}

function adicionarMeses(data: Date, quantidade: number) {
  return new Date(data.getFullYear(), data.getMonth() + quantidade, 1)
}

function formatarMesAno(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(data)
}

function formatarDiaSemanaCurto(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(data)
}

function formatarDiaMesCurto(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(obterDataLocal(dataIso))
}

function calcularReferenciaFaturaCartao(dataLancamento: string, diaFechamento?: number | null) {
  const data = obterDataLocal(dataLancamento)
  let anoFatura = data.getFullYear()
  let mesFatura = data.getMonth() + 1

  if (diaFechamento && data.getDate() > diaFechamento) {
    mesFatura += 1
    if (mesFatura > 12) {
      mesFatura = 1
      anoFatura += 1
    }
  }

  const dataReferencia = new Date(anoFatura, mesFatura - 1, 1)
  return {
    chave: `${anoFatura}-${String(mesFatura).padStart(2, "0")}`,
    dataReferencia,
    descricao: formatarMesAno(dataReferencia),
  }
}

function calcularDataVencimentoCartao(
  dataLancamento: string,
  diaFechamento?: number | null,
  diaVencimento?: number | null
) {
  const referencia = calcularReferenciaFaturaCartao(dataLancamento, diaFechamento)
  const dia = Math.max(1, Math.min(diaVencimento ?? 1, new Date(
    referencia.dataReferencia.getFullYear(),
    referencia.dataReferencia.getMonth() + 1,
    0
  ).getDate()))
  return normalizarIso(
    new Date(
      referencia.dataReferencia.getFullYear(),
      referencia.dataReferencia.getMonth(),
      dia
    )
  )
}

function calcularDataRecorrenteMensal(
  dataBase: string,
  diaRecorrenciaMensal: number,
  mesReferencia: Date
) {
  const base = obterDataLocal(dataBase)
  const inicioMesBase = new Date(base.getFullYear(), base.getMonth(), 1)
  const inicioMesReferencia = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1)

  if (inicioMesReferencia.getTime() < inicioMesBase.getTime()) {
    return dataBase
  }

  const ultimoDiaMes = new Date(
    mesReferencia.getFullYear(),
    mesReferencia.getMonth() + 1,
    0
  ).getDate()
  const dataProjetada = new Date(
    mesReferencia.getFullYear(),
    mesReferencia.getMonth(),
    Math.min(Math.max(diaRecorrenciaMensal, 1), ultimoDiaMes)
  )
  return normalizarIso(dataProjetada)
}

function estaNoMesmoMesAno(dataIso: string, mesReferencia: Date) {
  const data = obterDataLocal(dataIso)
  return (
    data.getFullYear() === mesReferencia.getFullYear() &&
    data.getMonth() === mesReferencia.getMonth()
  )
}

function obterStatusPagamento(transacao: Transacao, mesReferencia?: Date) {
  const statusBase =
    transacao.statusPagamento ?? (transacao.tipo === "despesa" ? "PENDENTE" : "PAGO")

  if (transacao.tipo !== "despesa") {
    return statusBase
  }

  // Compatibilidade para despesas antigas que ainda não tinham baixa registrada
  // e acabaram aparecendo como pagas após a introdução do novo fluxo.
  if (
    statusBase === "PAGO" &&
    !transacao.dataPagamento &&
    !transacao.contaPagamentoId &&
    (Boolean(transacao.dataVencimento) ||
      Boolean(transacao.recorrente) ||
      Boolean(transacao.parcelada) ||
      transacao.contaTipo === "cartao_credito")
  ) {
    return "PENDENTE"
  }

  if (mesReferencia && transacao.recorrente && transacao.diaRecorrenciaMensal) {
    if (statusBase === "PAGO") {
      return transacao.dataPagamento && estaNoMesmoMesAno(transacao.dataPagamento, mesReferencia)
        ? "PAGO"
        : "PENDENTE"
    }

    if (statusBase === "AGENDADO") {
      return transacao.dataAgendamentoPagamento &&
        estaNoMesmoMesAno(transacao.dataAgendamentoPagamento, mesReferencia)
        ? "AGENDADO"
        : "PENDENTE"
    }
  }

  return statusBase
}

function transacaoEstaVencida(transacao: Transacao, dataReferencia: string | null, mesReferencia?: Date) {
  if (!dataReferencia || obterStatusPagamento(transacao, mesReferencia) === "PAGO") {
    return false
  }
  return obterDataLocal(dataReferencia).getTime() < obterDataLocal(obterHojeIsoLocal()).getTime()
}

function itemEstaEmAlerta(item: AgendaItem) {
  if (item.statusPagamento === "PAGO" || !item.dataVencimento) {
    return false
  }

  const hoje = obterDataLocal(obterHojeIsoLocal())
  const vencimento = obterDataLocal(item.dataVencimento)
  const diferencaDias = Math.ceil(
    (vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
  )

  return diferencaDias <= 2
}

function obterVariantStatus(item: AgendaItem): React.ComponentProps<typeof Badge>["variant"] {
  if (itemEstaEmAlerta(item)) {
    return "destructive"
  }
  switch (item.statusPagamento) {
    case "AGENDADO":
      return "warning"
    case "PENDENTE":
      return "warning"
    case "PAGO":
    default:
      return "success"
  }
}

function obterRotuloStatus(item: AgendaItem) {
  if (itemEstaEmAlerta(item)) {
    return item.vencida ? "Vencido" : "Vence em até 2 dias"
  }
  switch (item.statusPagamento) {
    case "AGENDADO":
      return "Agendado"
    case "PENDENTE":
      return "Sem pagamento"
    case "PAGO":
    default:
      return "Pago"
  }
}

function obterClasseItemAgenda(item: AgendaItem) {
  if (item.statusPagamento === "PAGO") {
    return "border-emerald-200 bg-emerald-50/90 text-emerald-700"
  }

  if (itemEstaEmAlerta(item)) {
    return "border-rose-200 bg-rose-50/90 text-rose-700"
  }

  return "border-amber-200 bg-amber-50/90 text-amber-700"
}

function gerarDiasCalendario(mesReferencia: Date) {
  const primeiroDia = inicioDoMes(mesReferencia)
  const ultimoDia = fimDoMes(mesReferencia)
  const deslocamentoInicial = primeiroDia.getDay()
  const inicioGrade = adicionarDias(primeiroDia, -deslocamentoInicial)
  const dias: Date[] = []

  for (let indice = 0; indice < 42; indice += 1) {
    dias.push(adicionarDias(inicioGrade, indice))
  }

  return {
    dias,
    ultimoDia,
  }
}

function agruparPorData(items: AgendaItem[]) {
  const mapa = new Map<string, AgendaItem[]>()
  items.forEach((item) => {
    mapa.set(item.dataPrincipal, [...(mapa.get(item.dataPrincipal) ?? []), item])
  })
  return mapa
}

export function PaginaAgendaFinanceira() {
  const { moeda } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [visualizacao, setVisualizacao] = React.useState<VisualizacaoAgenda>("CALENDARIO")
  const [modoAgenda, setModoAgenda] = React.useState<ModoAgenda>("VENCIMENTO")
  const [filtroAgenda, setFiltroAgenda] = React.useState<FiltroAgenda>("TODOS")
  const [mesReferencia, setMesReferencia] = React.useState(() => inicioDoMes(new Date()))
  const [diaSelecionado, setDiaSelecionado] = React.useState<string>(obterHojeIsoLocal())
  const [itemSelecionadoId, setItemSelecionadoId] = React.useState<string | null>(null)
  const [statusEditado, setStatusEditado] = React.useState<NonNullable<Transacao["statusPagamento"]>>("PENDENTE")
  const [contaPagamentoEditada, setContaPagamentoEditada] = React.useState("")
  const [dataPagamentoEditada, setDataPagamentoEditada] = React.useState("")
  const [dataAgendamentoEditada, setDataAgendamentoEditada] = React.useState("")

  const contasQuery = useQuery({
    queryKey: ["contas"],
    queryFn: listarContasApi,
  })

  const categoriasQuery = useQuery({
    queryKey: ["categorias"],
    queryFn: listarCategoriasApi,
  })

  const transacoesQuery = useQuery({
    queryKey: ["transacoes", "agenda-financeira", contasQuery.data, categoriasQuery.data],
    queryFn: () => listarTransacoesApi(categoriasQuery.data ?? [], contasQuery.data ?? []),
    enabled: Boolean(contasQuery.data && categoriasQuery.data),
  })

  const contas = contasQuery.data ?? []
  const transacoes = transacoesQuery.data ?? []
  const transacoesPorId = React.useMemo(
    () => new Map(transacoes.map((transacao) => [transacao.id, transacao])),
    [transacoes]
  )

  const contasPorId = React.useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas]
  )
  const contasCartaoIds = React.useMemo(
    () =>
      contas
        .filter((conta) => conta.tipo === "cartao_credito")
        .map((conta) => conta.id)
        .sort(),
    [contas]
  )
  const contasPagamentoDisponiveis = React.useMemo(
    () => contas.filter((conta) => conta.tipo !== "cartao_credito"),
    [contas]
  )
  const historicoImportacoesQuery = useQuery({
    queryKey: ["historico-importacao-fatura-agenda", contasCartaoIds],
    queryFn: async () => {
      const historicos = await Promise.all(
        contasCartaoIds.map((contaId) => listarHistoricoImportacaoFaturaApi(contaId))
      )

      return historicos.flat()
    },
    enabled: contasCartaoIds.length > 0,
  })
  const historicoImportacoes = historicoImportacoesQuery.data ?? []
  const historicoImportacoesPorChave = React.useMemo(() => {
    const mapa = new Map<string, HistoricoImportacaoFaturaApi>()

    historicoImportacoes.forEach((importacao) => {
      const chave = `${importacao.contaId}-${importacao.referencia}`
      const existente = mapa.get(chave)

      if (
        !existente ||
        new Date(importacao.importadoEm).getTime() > new Date(existente.importadoEm).getTime()
      ) {
        mapa.set(chave, importacao)
      }
    })

    return mapa
  }, [historicoImportacoes])

  const agendaBase = React.useMemo<AgendaItem[]>(() => {
    const itensDespesa = transacoes
      .filter((transacao) => transacao.tipo === "despesa")
      .filter((transacao) => transacao.contaTipo !== "cartao_credito")
      .filter(
        (transacao) =>
          Boolean(transacao.dataVencimento) ||
          Boolean(transacao.diaRecorrenciaMensal) ||
          Boolean(transacao.dataAgendamentoPagamento) ||
          Boolean(transacao.dataPagamento) ||
          Boolean(transacao.recorrente) ||
          obterStatusPagamento(transacao, mesReferencia) !== "PAGO"
      )
      .map((transacao) => {
        const dataVencimento =
          transacao.recorrente && transacao.diaRecorrenciaMensal
            ? calcularDataRecorrenteMensal(
                transacao.dataVencimento ?? transacao.data,
                transacao.diaRecorrenciaMensal,
                mesReferencia
              )
            : transacao.dataVencimento ?? transacao.data
        const dataPrincipal =
          modoAgenda === "PAGAMENTO"
            ? transacao.dataPagamento ?? transacao.dataAgendamentoPagamento ?? dataVencimento
            : dataVencimento
        const contaPagamento = transacao.contaPagamentoId
          ? contasPorId.get(transacao.contaPagamentoId)
          : null

        return {
          id: transacao.id,
          titulo: transacao.descricao,
          descricao: transacao.recorrente
            ? "Despesa recorrente ou fixa"
            : transacao.parcelada
              ? "Parcela programada"
              : "Despesa avulsa com compromisso financeiro",
          valor: transacao.valor,
          valorTransacoes: transacao.valor,
          valorFaturaImportada: null,
          dataPrincipal,
          dataVencimento,
          dataPagamento: transacao.dataPagamento ?? null,
          dataAgendamentoPagamento: transacao.dataAgendamentoPagamento ?? null,
          statusPagamento: obterStatusPagamento(transacao, mesReferencia),
          origem: "despesa" as const,
          contaNome: transacao.conta,
          contaInstituicao: transacao.contaInstituicao,
          contaPagamentoNome: contaPagamento?.nome ?? null,
          recorrente: Boolean(transacao.recorrente),
          parcelada: Boolean(transacao.parcelada),
          rota: "/transacoes",
          vencida: transacaoEstaVencida(transacao, dataVencimento, mesReferencia),
          transacaoIds: [transacao.id],
        }
      })

    const gruposFatura = new Map<
      string,
      {
        conta: Conta
        dataVencimento: string
        referenciaChave: string
        referenciaDescricao: string
        itens: Transacao[]
      }
    >()

    transacoes
      .filter((transacao) => transacao.tipo === "despesa" && transacao.contaTipo === "cartao_credito")
      .forEach((transacao) => {
        const conta = transacao.contaId ? contasPorId.get(transacao.contaId) : undefined
        if (!conta) {
          return
        }

        const dataVencimento =
          transacao.dataVencimento ??
          calcularDataVencimentoCartao(
            transacao.data,
            conta.diaFechamento,
            conta.diaVencimento
          )

        const referencia = calcularReferenciaFaturaCartao(transacao.data, conta.diaFechamento)
        const chave = `${conta.id}-${dataVencimento}`
        const grupoAtual = gruposFatura.get(chave)

        if (grupoAtual) {
          grupoAtual.itens.push(transacao)
          return
        }

        gruposFatura.set(chave, {
          conta,
          dataVencimento,
          referenciaChave: referencia.chave,
          referenciaDescricao: referencia.descricao,
          itens: [transacao],
        })
      })

    const itensFatura = Array.from(gruposFatura.entries()).map(([chave, grupo]) => {
      const valorTransacoes = grupo.itens.reduce((total, item) => total + item.valor, 0)
      const importacaoRelacionada = historicoImportacoesPorChave.get(
        `${grupo.conta.id}-${grupo.referenciaChave}`
      )
      const valorFaturaImportada =
        importacaoRelacionada?.totalFatura ?? importacaoRelacionada?.valorImportadoPdf ?? null
      const valor = valorFaturaImportada ?? valorTransacoes
      const todosPagos = grupo.itens.every((item) => obterStatusPagamento(item, mesReferencia) === "PAGO")
      const existePendente = grupo.itens.some((item) => obterStatusPagamento(item, mesReferencia) === "PENDENTE")
      const statusPagamento: AgendaItem["statusPagamento"] = todosPagos
        ? "PAGO"
        : existePendente
          ? "PENDENTE"
          : "AGENDADO"
      const datasPagamento = grupo.itens
        .map((item) => item.dataPagamento)
        .filter(Boolean) as string[]
      const datasAgendamento = grupo.itens
        .map((item) => item.dataAgendamentoPagamento)
        .filter(Boolean) as string[]
      const dataPagamento =
        datasPagamento.length > 0
          ? [...datasPagamento].sort((a, b) => obterDataLocal(b).getTime() - obterDataLocal(a).getTime())[0]
          : null
      const dataAgendamentoPagamento =
        datasAgendamento.length > 0
          ? [...datasAgendamento].sort((a, b) => obterDataLocal(a).getTime() - obterDataLocal(b).getTime())[0]
          : null
      const dataPrincipal =
        modoAgenda === "PAGAMENTO"
          ? dataPagamento ?? dataAgendamentoPagamento ?? grupo.dataVencimento
          : grupo.dataVencimento

      return {
        id: chave,
        titulo: `Fatura ${grupo.conta.nome}`,
        descricao: `${grupo.itens.length} compra(s) consolidadas em ${grupo.referenciaDescricao}`,
        valor,
        valorTransacoes,
        valorFaturaImportada,
        dataPrincipal,
        dataVencimento: grupo.dataVencimento,
        dataPagamento,
        dataAgendamentoPagamento,
        statusPagamento,
        origem: "fatura_cartao" as const,
        contaNome: grupo.conta.nome,
        contaInstituicao: grupo.conta.instituicao,
        contaPagamentoNome: null,
        recorrente: true,
        parcelada: grupo.itens.some((item) => item.parcelada),
        rota: "/cartoes",
        vencida:
          statusPagamento !== "PAGO" &&
          obterDataLocal(grupo.dataVencimento).getTime() < obterDataLocal(obterHojeIsoLocal()).getTime(),
        transacaoIds: grupo.itens.map((item) => item.id),
      }
    })

    return [...itensDespesa, ...itensFatura]
  }, [contasPorId, historicoImportacoesPorChave, mesReferencia, modoAgenda, transacoes])

  const agendaFiltrada = React.useMemo(() => {
    const inicio = inicioDoMes(mesReferencia)
    const fim = fimDoMes(mesReferencia)

    return agendaBase
      .filter((item) => {
        const data = obterDataLocal(item.dataPrincipal)
        return data.getTime() >= inicio.getTime() && data.getTime() <= fim.getTime()
      })
      .filter((item) => {
        switch (filtroAgenda) {
          case "FIXAS":
            return item.origem === "despesa" && (item.recorrente || item.parcelada)
          case "FATURAS":
            return item.origem === "fatura_cartao"
          case "PENDENTES":
            return item.statusPagamento === "PENDENTE"
          case "AGENDADOS":
            return item.statusPagamento === "AGENDADO"
          case "PAGOS":
            return item.statusPagamento === "PAGO"
          case "VENCIDOS":
            return item.vencida
          case "TODOS":
          default:
            return true
        }
      })
      .sort((a, b) => obterDataLocal(a.dataPrincipal).getTime() - obterDataLocal(b.dataPrincipal).getTime())
  }, [agendaBase, filtroAgenda, mesReferencia])

  const itensPorData = React.useMemo(() => agruparPorData(agendaFiltrada), [agendaFiltrada])
  const agendaDoDiaSelecionado = React.useMemo(
    () => itensPorData.get(diaSelecionado) ?? [],
    [diaSelecionado, itensPorData]
  )

  const { dias } = React.useMemo(() => gerarDiasCalendario(mesReferencia), [mesReferencia])

  React.useEffect(() => {
    const primeiroItemDoMes = agendaFiltrada[0]
    if (primeiroItemDoMes) {
      setDiaSelecionado((atual) =>
        itensPorData.has(atual) ? atual : primeiroItemDoMes.dataPrincipal
      )
      return
    }

    const hoje = obterHojeIsoLocal()
    const estaNoMes =
      obterDataLocal(hoje).getMonth() === mesReferencia.getMonth() &&
      obterDataLocal(hoje).getFullYear() === mesReferencia.getFullYear()
    if (estaNoMes) {
      setDiaSelecionado(hoje)
    } else {
      setDiaSelecionado(normalizarIso(inicioDoMes(mesReferencia)))
    }
  }, [agendaFiltrada, itensPorData, mesReferencia])

  const totais = React.useMemo(() => {
    const emAberto = agendaFiltrada
      .filter((item) => item.statusPagamento !== "PAGO")
      .reduce((total, item) => total + item.valor, 0)
    const vencendoSemana = agendaBase
      .filter((item) => item.statusPagamento !== "PAGO")
      .filter((item) => {
        const vencimento = item.dataVencimento ?? item.dataPrincipal
        const data = obterDataLocal(vencimento)
        const hoje = obterDataLocal(obterHojeIsoLocal())
        const limite = adicionarDias(hoje, 7)
        return data.getTime() >= hoje.getTime() && data.getTime() <= limite.getTime()
      })
      .reduce((total, item) => total + item.valor, 0)
    const recorrencias = agendaBase.filter(
      (item) => item.origem === "despesa" && (item.recorrente || item.parcelada)
    ).length
    const faturasAbertas = agendaBase
      .filter((item) => item.origem === "fatura_cartao" && item.statusPagamento !== "PAGO")
      .reduce((total, item) => total + item.valor, 0)

    return {
      emAberto,
      vencendoSemana,
      recorrencias,
      faturasAbertas,
    }
  }, [agendaBase, agendaFiltrada])

  const resumoDiaSelecionado = agendaDoDiaSelecionado.reduce((total, item) => total + item.valor, 0)
  const itemSelecionado = React.useMemo(
    () => agendaBase.find((item) => item.id === itemSelecionadoId) ?? null,
    [agendaBase, itemSelecionadoId]
  )
  const transacoesSelecionadas = React.useMemo(
    () => {
      if (!itemSelecionado) {
        return []
      }

      return itemSelecionado.transacaoIds
        .map((transacaoId) => transacoesPorId.get(transacaoId))
        .filter(Boolean) as Transacao[]
    },
    [itemSelecionado, transacoesPorId]
  )

  React.useEffect(() => {
    if (!itemSelecionado) {
      return
    }

    setStatusEditado(itemSelecionado.statusPagamento)
    setContaPagamentoEditada(
      transacoesSelecionadas
        .map((transacao) => transacao.contaPagamentoId)
        .find(Boolean) ?? ""
    )
    setDataPagamentoEditada(itemSelecionado.dataPagamento ?? "")
    setDataAgendamentoEditada(itemSelecionado.dataAgendamentoPagamento ?? "")
  }, [itemSelecionado, transacoesSelecionadas])

  const salvarStatusMutation = useMutation({
    mutationFn: async () => {
      if (!itemSelecionado) {
        throw new Error("Nenhum compromisso selecionado")
      }

      const exigeContaPagamento =
        itemSelecionado.origem === "fatura_cartao" ||
        transacoesSelecionadas.some((transacao) => transacao.contaTipo === "cartao_credito")

      if (statusEditado === "PAGO" && exigeContaPagamento && !contaPagamentoEditada) {
        throw new Error("Selecione a conta que quitou esse compromisso.")
      }

      for (const transacaoId of itemSelecionado.transacaoIds) {
        await atualizarStatusPagamentoTransacaoApi(transacaoId, {
          statusPagamento: statusEditado,
          dataAgendamentoPagamento:
            statusEditado === "AGENDADO" ? dataAgendamentoEditada || null : null,
          dataPagamento:
            statusEditado === "PAGO" ? dataPagamentoEditada || obterHojeIsoLocal() : null,
          contaPagamentoId: contaPagamentoEditada || null,
        })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transacoes"] })
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
    },
  })

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Agenda financeira"
        descricao="Veja o que vence, o que esta agendado e o que ja foi pago entre contas fixas, recorrentes e faturas."
        acoes={
          <>
            <Select value={modoAgenda} onValueChange={(valor) => setModoAgenda(valor as ModoAgenda)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VENCIMENTO">Base por vencimento</SelectItem>
                <SelectItem value="PAGAMENTO">Base por pagamento</SelectItem>
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-md border border-border/70 bg-background p-1">
              <Button
                size="sm"
                variant={visualizacao === "CALENDARIO" ? "secondary" : "ghost"}
                onClick={() => setVisualizacao("CALENDARIO")}
              >
                <IconCalendarMonth className="size-4" />
                Calendario
              </Button>
              <Button
                size="sm"
                variant={visualizacao === "LISTA" ? "secondary" : "ghost"}
                onClick={() => setVisualizacao("LISTA")}
              >
                <IconListDetails className="size-4" />
                Lista
              </Button>
            </div>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <div className="space-y-4">
          <Card className="border-border/70">
            <CardHeader className="pb-4">
              <CardTitle>Fluxo ideal para contas fixas</CardTitle>
              <CardDescription>
                Para apartamento, condominio e outras despesas fixas, registre a transacao como
                despesa recorrente, informe o vencimento e deixe como a pagar ou agendada ate a
                baixa real.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconRepeat className="size-4 text-primary" />
                  Conta fixa
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Marque como recorrente para aparecer continuamente na agenda e nos filtros.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconClock className="size-4 text-amber-600" />
                  Agendamento
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use o status agendado quando o pagamento ja estiver programado, mas ainda nao liquidado.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconCreditCard className="size-4 text-rose-600" />
                  Fatura do cartao
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  A agenda consolida a fatura por cartao para voce enxergar a quitacao como compromisso unico.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Em aberto</p>
                <p className="mt-2 text-2xl font-semibold">{formatarMoeda(totais.emAberto, moeda)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Compromissos do mes ainda sem baixa.</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Vence em 7 dias</p>
                <p className="mt-2 text-2xl font-semibold">{formatarMoeda(totais.vencendoSemana, moeda)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ajuda a agir antes do aperto no caixa.</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fixas e recorrentes</p>
                <p className="mt-2 text-2xl font-semibold">{totais.recorrencias}</p>
                <p className="mt-1 text-xs text-muted-foreground">Itens ativos com previsibilidade recorrente.</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Faturas abertas</p>
                <p className="mt-2 text-2xl font-semibold">{formatarMoeda(totais.faturasAbertas, moeda)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Total consolidado das faturas ainda em aberto.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <Button size="icon-sm" variant="ghost" onClick={() => setMesReferencia((atual) => adicionarMeses(atual, -1))}>
                    <IconChevronLeft className="size-4" />
                  </Button>
                  <div>
                    <CardTitle className="capitalize">{formatarMesAno(mesReferencia)}</CardTitle>
                    <CardDescription>{agendaFiltrada.length} compromisso(s) no periodo selecionado</CardDescription>
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={() => setMesReferencia((atual) => adicionarMeses(atual, 1))}>
                    <IconChevronRight className="size-4" />
                  </Button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={filtroAgenda} onValueChange={(valor) => setFiltroAgenda(valor as FiltroAgenda)}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos os compromissos</SelectItem>
                      <SelectItem value="FIXAS">Fixas e recorrentes</SelectItem>
                      <SelectItem value="FATURAS">Somente faturas</SelectItem>
                      <SelectItem value="PENDENTES">A pagar</SelectItem>
                      <SelectItem value="AGENDADOS">Agendados</SelectItem>
                      <SelectItem value="PAGOS">Pagos</SelectItem>
                      <SelectItem value="VENCIDOS">Vencidos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setMesReferencia(inicioDoMes(new Date()))}>
                    Mes atual
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {visualizacao === "CALENDARIO" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }, (_, indice) => (
                      <div
                        key={indice}
                        className="px-2 py-1 text-center text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {formatarDiaSemanaCurto(adicionarDias(new Date(2026, 6, 5), indice))}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
                    {dias.map((dia) => {
                      const chaveDia = normalizarIso(dia)
                      const itensDia = itensPorData.get(chaveDia) ?? []
                      const foraDoMes = dia.getMonth() !== mesReferencia.getMonth()
                      const selecionado = diaSelecionado === chaveDia
                      const hoje = chaveDia === obterHojeIsoLocal()

                      return (
                        <button
                          key={chaveDia}
                          type="button"
                          onClick={() => setDiaSelecionado(chaveDia)}
                          className={cn(
                            "min-h-36 rounded-xl border p-3 text-left transition-colors",
                            selecionado
                              ? "border-primary bg-primary/5"
                              : "border-border/70 hover:bg-muted/20",
                            foraDoMes && "opacity-45"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                hoje && "rounded-full bg-primary px-2 py-0.5 text-primary-foreground"
                              )}
                            >
                              {dia.getDate()}
                            </span>
                            {itensDia.length > 0 ? (
                              <Badge variant="secondary">{itensDia.length}</Badge>
                            ) : null}
                          </div>

                          <div className="mt-3 space-y-2">
                            {itensDia.slice(0, 3).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setItemSelecionadoId(item.id)
                                }}
                                className={cn(
                                  "block w-full rounded-lg border px-2 py-1.5 text-left text-xs transition-colors hover:opacity-90",
                                  obterClasseItemAgenda(item)
                                )}
                              >
                                <p className="truncate font-medium">{item.titulo}</p>
                                <p className="mt-0.5 truncate">{formatarMoeda(item.valor, moeda)}</p>
                              </button>
                            ))}
                            {itensDia.length > 3 ? (
                              <p className="text-[0.7rem] text-muted-foreground">
                                +{itensDia.length - 3} outros itens
                              </p>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : agendaFiltrada.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center">
                  <p className="text-sm font-medium">Nenhum compromisso encontrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ajuste o filtro ou informe vencimento nas despesas fixas para alimentar a agenda.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendaFiltrada.map((item, indice) => (
                    <React.Fragment key={item.id}>
                      {indice > 0 ? <Separator /> : null}
                      <button
                        type="button"
                        className="flex w-full flex-col gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-muted/20"
                        onClick={() => setItemSelecionadoId(item.id)}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">{item.titulo}</p>
                              <Badge variant={obterVariantStatus(item)}>{obterRotuloStatus(item)}</Badge>
                              {item.recorrente ? <Badge variant="secondary">Recorrente</Badge> : null}
                              {item.parcelada ? <Badge variant="outline">Parcelada</Badge> : null}
                              {item.origem === "fatura_cartao" ? (
                                <Badge variant="outline">Fatura</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{item.descricao}</p>
                          </div>
                          <div className="text-left lg:text-right">
                            <p className="text-lg font-semibold">{formatarMoeda(item.valor, moeda)}</p>
                            <p className="text-xs text-muted-foreground">
                              {modoAgenda === "PAGAMENTO" ? "Data-chave de pagamento" : "Data-chave de vencimento"}:{" "}
                              {formatarData(item.dataPrincipal)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <LogoBanco instituicao={item.contaInstituicao} tamanho="sm" />
                            {item.contaNome}
                          </span>
                          {item.dataVencimento ? <span>Vence em {formatarData(item.dataVencimento)}</span> : null}
                          {item.dataAgendamentoPagamento ? (
                            <span>Agendado para {formatarData(item.dataAgendamentoPagamento)}</span>
                          ) : null}
                          {item.dataPagamento ? <span>Pago em {formatarData(item.dataPagamento)}</span> : null}
                          {item.contaPagamentoNome ? <span>Baixa em {item.contaPagamentoNome}</span> : null}
                        </div>
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>
                {visualizacao === "CALENDARIO"
                  ? `Dia ${formatarDiaMesCurto(diaSelecionado)}`
                  : "Leitura rapida"}
              </CardTitle>
              <CardDescription>
                {visualizacao === "CALENDARIO"
                  ? `${agendaDoDiaSelecionado.length} item(ns) no dia selecionado.`
                  : "Panorama dos compromissos do periodo atual."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {visualizacao === "CALENDARIO" ? (
                agendaDoDiaSelecionado.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum compromisso para este dia.
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total do dia</p>
                      <p className="mt-2 text-2xl font-semibold">{formatarMoeda(resumoDiaSelecionado, moeda)}</p>
                    </div>

                    {agendaDoDiaSelecionado.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setItemSelecionadoId(item.id)}
                        className={cn(
                          "w-full rounded-xl border p-4 text-left transition-colors hover:opacity-95",
                          obterClasseItemAgenda(item)
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold">{item.titulo}</p>
                              <Badge variant={obterVariantStatus(item)}>{obterRotuloStatus(item)}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{item.descricao}</p>
                          </div>
                          <span className="text-sm font-semibold">{formatarMoeda(item.valor, moeda)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{item.contaNome}</span>
                          {item.dataPagamento ? <span>Pago em {formatarData(item.dataPagamento)}</span> : null}
                          {item.dataVencimento ? <span>Vence em {formatarData(item.dataVencimento)}</span> : null}
                        </div>
                      </button>
                    ))}
                  </>
                )
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <IconAlertTriangle className="size-4 text-destructive" />
                      Vencidos
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {agendaFiltrada.filter((item) => item.vencida).length} compromisso(s) vencido(s) neste mes.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <IconClock className="size-4 text-amber-600" />
                      Agendados
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {agendaFiltrada.filter((item) => item.statusPagamento === "AGENDADO").length} item(ns) ja programados para pagamento.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <IconCheck className="size-4 text-emerald-600" />
                      Pagos
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {agendaFiltrada.filter((item) => item.statusPagamento === "PAGO").length} compromisso(s) ja quitados no periodo.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Como usar bem</CardTitle>
              <CardDescription>
                Estruture as despesas para a agenda virar seu painel principal de execucao.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/70 p-4">
                <p className="font-medium text-foreground">Moradia e contas fixas</p>
                <p className="mt-1">
                  Cadastre como despesa, marque recorrente e informe a data de vencimento.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="font-medium text-foreground">Parcelas longas</p>
                <p className="mt-1">
                  Use parcelamento para financiamento, apartamento ou compras planejadas. As parcelas futuras entram na agenda automaticamente.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="font-medium text-foreground">Cartao de credito</p>
                <p className="mt-1">
                  A agenda consolida as compras por fatura para voce acompanhar o valor total a quitar em cada vencimento.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet
        open={Boolean(itemSelecionado)}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setItemSelecionadoId(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          {itemSelecionado ? (
            <>
              <SheetHeader className="border-b border-border/70">
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-xl border p-3", obterClasseItemAgenda(itemSelecionado))}>
                    {itemSelecionado.origem === "fatura_cartao" ? (
                      <IconCreditCard className="size-5" />
                    ) : (
                      <IconReceipt2 className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SheetTitle>{itemSelecionado.titulo}</SheetTitle>
                      <Badge variant={obterVariantStatus(itemSelecionado)}>
                        {obterRotuloStatus(itemSelecionado)}
                      </Badge>
                    </div>
                    <SheetDescription>{itemSelecionado.descricao}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="rounded-xl border border-border/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                  <p className="mt-2 text-3xl font-semibold">{formatarMoeda(itemSelecionado.valor, moeda)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {itemSelecionado.origem === "fatura_cartao"
                      ? `${itemSelecionado.transacaoIds.length} transacao(oes) consolidadas nesta fatura`
                      : "Compromisso individual da agenda"}
                  </p>
                  {itemSelecionado.origem === "fatura_cartao" &&
                  itemSelecionado.valorFaturaImportada !== null &&
                  Math.abs(itemSelecionado.valorFaturaImportada - itemSelecionado.valorTransacoes) > 0.009 ? (
                    <div className="mt-4 space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Total liquido da fatura</span>
                        <span className="font-medium">
                          {formatarMoeda(itemSelecionado.valorFaturaImportada, moeda)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Soma das compras do ciclo</span>
                        <span className="font-medium">
                          {formatarMoeda(itemSelecionado.valorTransacoes, moeda)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Conta de origem</p>
                    <div className="mt-2 flex items-center gap-2">
                      <LogoBanco instituicao={itemSelecionado.contaInstituicao} tamanho="sm" />
                      <span className="font-medium">{itemSelecionado.contaNome}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {modoAgenda === "PAGAMENTO" ? "Data-chave de pagamento" : "Data-chave de vencimento"}
                    </p>
                    <p className="mt-2 font-medium">{formatarData(itemSelecionado.dataPrincipal)}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Vencimento</p>
                    <p className="mt-2 font-medium">
                      {itemSelecionado.dataVencimento ? formatarData(itemSelecionado.dataVencimento) : "Nao informado"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Baixa em conta</p>
                    <p className="mt-2 font-medium">{itemSelecionado.contaPagamentoNome ?? "Ainda sem conta de baixa"}</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Status</Label>
                    <Select
                      value={statusEditado}
                      onValueChange={(valor) =>
                        setStatusEditado(valor as NonNullable<Transacao["statusPagamento"]>)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDENTE">Sem pagamento</SelectItem>
                        <SelectItem value="AGENDADO">Pagamento agendado</SelectItem>
                        <SelectItem value="PAGO">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {statusEditado === "PAGO" ? "Conta que pagou" : "Conta prevista para a baixa"}
                    </Label>
                    <Select
                      value={contaPagamentoEditada || "SEM_CONTA"}
                      onValueChange={(valor) =>
                        setContaPagamentoEditada(valor === "SEM_CONTA" ? "" : valor)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar depois" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SEM_CONTA">Selecionar depois</SelectItem>
                        {contasPagamentoDisponiveis.map((conta) => (
                          <SelectItem key={conta.id} value={conta.id}>
                            {conta.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {statusEditado === "AGENDADO" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Data do agendamento</Label>
                      <Input
                        type="date"
                        value={dataAgendamentoEditada}
                        onChange={(event) => setDataAgendamentoEditada(event.target.value)}
                      />
                    </div>
                  ) : null}

                  {statusEditado === "PAGO" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Data do pagamento</Label>
                      <Input
                        type="date"
                        value={dataPagamentoEditada}
                        onChange={(event) => setDataPagamentoEditada(event.target.value)}
                      />
                    </div>
                  ) : null}

                  {salvarStatusMutation.isError ? (
                    <p className="text-xs text-destructive">
                      {salvarStatusMutation.error instanceof Error
                        ? salvarStatusMutation.error.message
                        : "Nao foi possivel atualizar o status."}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  {statusEditado === "PAGO"
                    ? "Quando salvo como pago, o sistema baixa o valor da conta correspondente."
                    : statusEditado === "AGENDADO"
                      ? "Agendado continua sem baixa real em conta, mas entra no radar da agenda."
                      : "Sem pagamento fica em acompanhamento ativo e aparece em amarelo ou vermelho quando o prazo aperta."}
                </div>
              </div>

              <SheetFooter className="border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigate(itemSelecionado.rota)
                    setItemSelecionadoId(null)
                  }}
                >
                  Abrir tela completa
                </Button>
                <Button
                  type="button"
                  disabled={salvarStatusMutation.isPending}
                  onClick={() => void salvarStatusMutation.mutateAsync()}
                >
                  {salvarStatusMutation.isPending ? "Salvando..." : "Salvar status"}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
