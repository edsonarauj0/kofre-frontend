import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  IconAlertTriangle,
  IconCalendarMonth,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconCreditCard,
  IconGripVertical,
  IconLayoutGrid,
  IconReceipt2,
  IconRepeat,
  IconTarget,
} from "@tabler/icons-react"

import { useAuth } from "@/app/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listarContasApi } from "@/features/contas/api/contas-api"
import {
  listarHistoricoImportacaoFaturaApi,
  type HistoricoImportacaoFaturaApi,
} from "@/features/ia/api/importacao-fatura-api"
import { useTransacaoExplorer } from "@/features/transacoes/components/transacao-explorer"
import {
  listarCategoriasApi,
  listarTransacoesApi,
} from "@/features/transacoes/api/transacoes-api"
import { cn } from "@/lib/utils"
import { LogoBanco } from "@/shared/components/logo-banco"
import {
  formatarData,
  formatarMoeda,
  formatarPercentual,
  obterSimboloMoeda,
} from "@/shared/lib/formatadores"
import type { Conta, Transacao } from "@/shared/types/financeiro"

const CHAVE_VISIBILIDADE_DASHBOARD = "kofre.dashboard.sections.v1"
const CHAVE_ORDEM_DASHBOARD = "kofre.dashboard.order.v1"
const CHAVE_TAMANHO_DASHBOARD = "kofre.dashboard.size.v1"

const paletaCategorias = [
  "#8A93A5",
  "#B96018",
  "#1CB6D4",
  "#6F52F5",
  "#5C667A",
  "#F59E0B",
  "#10B981",
  "#F97316",
]

type ModoComparacao = "despesa" | "receita"

type SectionId =
  | "saldo"
  | "faturas"
  | "investimentos-nacionais"
  | "investimentos-internacionais"
  | "comparacao"
  | "categorias"
  | "orcamento"
  | "revisar"
  | "transacoes"
  | "principais-categorias"
  | "evolucao-grupo"
  | "despesas-grupo"

type ConfiguracaoSecoes = Record<SectionId, boolean>
type AreaDashboard = "hero" | "detail"
type OrdemDashboard = Record<AreaDashboard, SectionId[]>
type TamanhoCardDashboard = "padrao" | "largo"
type TamanhoDashboard = Partial<Record<SectionId, TamanhoCardDashboard>>

type CompromissoDashboard = {
  id: string
  titulo: string
  descricao: string
  valor: number
  dataVencimento: string
  dataPagamento: string | null
  dataAgendamentoPagamento: string | null
  statusPagamento: NonNullable<Transacao["statusPagamento"]>
  origem: "despesa" | "fatura_cartao"
  contaNome: string
  contaInstituicao?: string
  recorrente: boolean
  parcelada: boolean
  vencida: boolean
  diasParaVencer: number | null
}

const configuracaoPadrao: ConfiguracaoSecoes = {
  saldo: true,
  faturas: true,
  "investimentos-nacionais": true,
  "investimentos-internacionais": true,
  comparacao: true,
  categorias: true,
  orcamento: true,
  revisar: true,
  transacoes: true,
  "principais-categorias": true,
  "evolucao-grupo": true,
  "despesas-grupo": true,
}

const secoesConfiguraveis: Array<{
  id: SectionId
  titulo: string
  descricao: string
}> = [
  {
    id: "saldo",
    titulo: "Saldo em Conta",
    descricao: "Saldo total e distribuicao por conta.",
  },
  {
    id: "faturas",
    titulo: "Faturas de Cartao",
    descricao: "Comprometimento atual dos cartoes.",
  },
  {
    id: "investimentos-nacionais",
    titulo: "Investimentos Nacionais",
    descricao: "Posicao das contas de investimento.",
  },
  {
    id: "investimentos-internacionais",
    titulo: "Investimentos Internacionais",
    descricao: "Posicao de corretoras e ativos externos.",
  },
  {
    id: "comparacao",
    titulo: "Comparacao 30 dias",
    descricao: "Linha acumulada entre o mes escolhido e o anterior.",
  },
  {
    id: "categorias",
    titulo: "Gastos por Categoria",
    descricao: "Distribuicao e peso das categorias.",
  },
  {
    id: "orcamento",
    titulo: "Planner do Mes",
    descricao: "Plano de acao para vencimentos e recorrencias.",
  },
  {
    id: "revisar",
    titulo: "Para Revisar",
    descricao: "Itens recentes para confirmar classificacao.",
  },
  {
    id: "transacoes",
    titulo: "Transacoes",
    descricao: "Lista das movimentacoes mais recentes.",
  },
  {
    id: "principais-categorias",
    titulo: "Principais Categorias",
    descricao: "Ranking atual contra periodo anterior.",
  },
  {
    id: "evolucao-grupo",
    titulo: "Evolucao por Grupo",
    descricao: "Serie temporal por grupo selecionado.",
  },
  {
    id: "despesas-grupo",
    titulo: "Despesas por Grupo",
    descricao: "Composicao mensal empilhada.",
  },
]

const heroSections: SectionId[] = [
  "saldo",
  "faturas",
  "investimentos-nacionais",
  "investimentos-internacionais",
]

const detailSections: SectionId[] = [
  "comparacao",
  "categorias",
  "orcamento",
  "revisar",
  "transacoes",
  "principais-categorias",
  "evolucao-grupo",
  "despesas-grupo",
]

const ordemDashboardPadrao: OrdemDashboard = {
  hero: heroSections,
  detail: detailSections,
}

const tamanhoDashboardPadrao: TamanhoDashboard = {
  comparacao: "largo",
  "principais-categorias": "largo",
  "despesas-grupo": "largo",
}

const nomesTipoConta: Record<string, string> = {
  corrente: "Conta Corrente",
  poupanca: "Poupanca",
  investimento: "Investimentos",
  carteira: "Carteira",
  cartao_credito: "Cartao de credito",
  cripto: "Cripto",
}

const CATEGORIA_REVISAO_IA = "para revisar ia"
const CATEGORIA_FALLBACK_IMPORTACAO_IA = "compras diversas"

function normalizarTexto(valor?: string | null) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

function obterDataLocal(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

function obterInicioMes(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), 1)
}

function normalizarIso(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function calcularReferenciaFaturaCartao(
  dataLancamento: string,
  diaFechamento?: number | null
) {
  const data = obterDataLocal(dataLancamento)

  if (!diaFechamento) {
    return new Date(data.getFullYear(), data.getMonth(), 1)
  }

  let anoFatura = data.getFullYear()
  let mesFatura = data.getMonth() + 1

  if (data.getDate() > diaFechamento) {
    mesFatura += 1
    if (mesFatura > 12) {
      mesFatura = 1
      anoFatura += 1
    }
  }

  return new Date(anoFatura, mesFatura - 1, 1)
}

function calcularDataVencimentoCartao(
  dataLancamento: string,
  diaFechamento?: number | null,
  diaVencimento?: number | null
) {
  const referencia = calcularReferenciaFaturaCartao(
    dataLancamento,
    diaFechamento
  )
  const ultimoDiaMes = new Date(
    referencia.getFullYear(),
    referencia.getMonth() + 1,
    0
  ).getDate()
  const dia = Math.max(1, Math.min(diaVencimento ?? 1, ultimoDiaMes))

  return normalizarIso(
    new Date(referencia.getFullYear(), referencia.getMonth(), dia)
  )
}

function calcularDataRecorrenteMensal(
  dataBase: string,
  diaRecorrenciaMensal: number,
  mesReferencia: Date
) {
  const base = obterDataLocal(dataBase)
  const inicioMesBase = new Date(base.getFullYear(), base.getMonth(), 1)
  const inicioMesReferencia = new Date(
    mesReferencia.getFullYear(),
    mesReferencia.getMonth(),
    1
  )

  if (inicioMesReferencia.getTime() < inicioMesBase.getTime()) {
    return dataBase
  }

  const ultimoDiaMes = new Date(
    mesReferencia.getFullYear(),
    mesReferencia.getMonth() + 1,
    0
  ).getDate()

  return normalizarIso(
    new Date(
      mesReferencia.getFullYear(),
      mesReferencia.getMonth(),
      Math.min(Math.max(diaRecorrenciaMensal, 1), ultimoDiaMes)
    )
  )
}

function adicionarMes(data: Date, quantidade: number) {
  return new Date(data.getFullYear(), data.getMonth() + quantidade, 1)
}

function formatarRotuloMes(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  })
    .format(data)
    .replace(".", "")
}

function obterChaveMes(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
}

function estaNoMesmoMesAno(dataIso: string, mesReferencia: Date) {
  const data = obterDataLocal(dataIso)
  return (
    data.getFullYear() === mesReferencia.getFullYear() &&
    data.getMonth() === mesReferencia.getMonth()
  )
}

function obterStatusPagamentoDashboard(
  transacao: Transacao,
  mesReferencia?: Date
) {
  const statusBase =
    transacao.statusPagamento ?? (transacao.tipo === "despesa" ? "PENDENTE" : "PAGO")

  if (transacao.tipo !== "despesa") {
    return statusBase
  }

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
      return transacao.dataPagamento &&
        estaNoMesmoMesAno(transacao.dataPagamento, mesReferencia)
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

function compromissoEstaEmAlerta(item: CompromissoDashboard) {
  if (item.statusPagamento === "PAGO") {
    return false
  }

  return item.diasParaVencer !== null && item.diasParaVencer <= 2
}

function obterVariantCompromisso(item: CompromissoDashboard) {
  if (item.vencida || compromissoEstaEmAlerta(item)) {
    return "destructive" as const
  }

  switch (item.statusPagamento) {
    case "AGENDADO":
      return "secondary" as const
    case "PAGO":
      return "success" as const
    case "PENDENTE":
    default:
      return "warning" as const
  }
}

function obterRotuloCompromisso(item: CompromissoDashboard) {
  if (item.vencida) {
    return "Vencido"
  }

  if (
    item.statusPagamento !== "PAGO" &&
    item.diasParaVencer !== null &&
    item.diasParaVencer <= 2
  ) {
    return "Vence logo"
  }

  switch (item.statusPagamento) {
    case "AGENDADO":
      return "Agendado"
    case "PAGO":
      return "Pago"
    case "PENDENTE":
    default:
      return "A pagar"
  }
}

function obterEmojiCategoria(categoria: string) {
  const chave = categoria.toLowerCase()

  if (chave.includes("morad")) return "🏠"
  if (chave.includes("transport")) return "🚗"
  if (chave.includes("emprest")) return "🏦"
  if (chave.includes("imposto")) return "📋"
  if (chave.includes("merc") || chave.includes("super")) return "🛍️"
  if (chave.includes("saude")) return "💊"
  if (chave.includes("aliment")) return "🍽️"
  if (chave.includes("compra")) return "🛒"
  if (chave.includes("serv")) return "💻"
  if (chave.includes("telecom")) return "📱"

  return "📦"
}

function obterConfigDaCategoria(categoria: string, indice: number) {
  return {
    cor: paletaCategorias[indice % paletaCategorias.length],
    emoji: obterEmojiCategoria(categoria),
  }
}

function variantPorVariacao(valor: number | null) {
  if (valor === null) return "secondary" as const
  if (valor <= 0) return "success" as const
  return "destructive" as const
}

function lerConfiguracaoSecoes() {
  try {
    if (typeof window === "undefined") {
      return configuracaoPadrao
    }

    const salvo = window.localStorage.getItem(CHAVE_VISIBILIDADE_DASHBOARD)
    if (!salvo) {
      return configuracaoPadrao
    }

    const parsed = JSON.parse(salvo) as Partial<ConfiguracaoSecoes>
    return {
      ...configuracaoPadrao,
      ...parsed,
    }
  } catch {
    return configuracaoPadrao
  }
}

function normalizarOrdemSecoes(ordemSalva: SectionId[] | undefined, base: SectionId[]) {
  const ordemValida = (ordemSalva ?? []).filter((item, indice, array) => {
    return base.includes(item) && array.indexOf(item) === indice
  })

  return [...ordemValida, ...base.filter((item) => !ordemValida.includes(item))]
}

function lerOrdemDashboard() {
  try {
    if (typeof window === "undefined") {
      return ordemDashboardPadrao
    }

    const salvo = window.localStorage.getItem(CHAVE_ORDEM_DASHBOARD)
    if (!salvo) {
      return ordemDashboardPadrao
    }

    const parsed = JSON.parse(salvo) as Partial<OrdemDashboard>
    return {
      hero: normalizarOrdemSecoes(parsed.hero, heroSections),
      detail: normalizarOrdemSecoes(parsed.detail, detailSections),
    }
  } catch {
    return ordemDashboardPadrao
  }
}

function lerTamanhoDashboard() {
  try {
    if (typeof window === "undefined") {
      return tamanhoDashboardPadrao
    }

    const salvo = window.localStorage.getItem(CHAVE_TAMANHO_DASHBOARD)
    if (!salvo) {
      return tamanhoDashboardPadrao
    }

    const parsed = JSON.parse(salvo) as TamanhoDashboard
    return {
      ...tamanhoDashboardPadrao,
      ...parsed,
    }
  } catch {
    return tamanhoDashboardPadrao
  }
}

function obterClasseTamanhoCard(
  area: AreaDashboard,
  tamanho: TamanhoCardDashboard | undefined
) {
  if (area !== "detail") {
    return ""
  }

  return tamanho === "largo" ? "xl:col-span-2" : ""
}

function DashboardOrdenavelSlot({
  area,
  sectionId,
  order,
  dragAtivo,
  tamanho,
  onAlternarTamanho,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  className,
  children,
}: {
  area: AreaDashboard
  sectionId: SectionId
  order: number
  dragAtivo: { area: AreaDashboard; sectionId: SectionId } | null
  tamanho?: TamanhoCardDashboard
  onAlternarTamanho?: (sectionId: SectionId) => void
  onDragStart: (area: AreaDashboard, sectionId: SectionId) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop: (area: AreaDashboard, sectionId: SectionId) => void
  className?: string
  children: React.ReactNode
}) {
  const estaArrastando =
    dragAtivo?.area === area && dragAtivo.sectionId === sectionId
  const podeReceber =
    dragAtivo?.area === area && dragAtivo.sectionId !== sectionId

  return (
    <div
      style={{ order }}
      onDragOver={onDragOver}
      onDrop={() => onDrop(area, sectionId)}
      className={cn(
        "group/slot relative min-w-0 transition-all",
        podeReceber && "rounded-lg outline-2 outline-primary/30 outline-dashed",
        estaArrastando && "scale-[0.99] opacity-65",
        className
      )}
    >
      {area === "detail" && onAlternarTamanho ? (
        <button
          type="button"
          onClick={() => onAlternarTamanho(sectionId)}
          className="absolute -top-2 left-4 z-10 inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          title={
            tamanho === "largo"
              ? "Reduzir largura do card"
              : "Expandir largura do card"
          }
        >
          {tamanho === "largo" ? "2 col" : "1 col"}
        </button>
      ) : null}
      <div
        draggable
        onDragStart={() => onDragStart(area, sectionId)}
        onDragEnd={onDragEnd}
        className="absolute -top-2 right-4 z-10 inline-flex cursor-grab items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground active:cursor-grabbing"
        title="Arraste para reorganizar este card"
      >
        <IconGripVertical className="size-3.5" />
        Arrastar
      </div>
      {children}
    </div>
  )
}

function CardBase({
  titulo,
  action,
  children,
  className,
  contentClassName,
}: {
  titulo: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card
      className={cn(
        "rounded-md border-border/60 bg-card/80 shadow-none backdrop-blur",
        className
      )}
    >
      <CardHeader className="gap-2 px-5 pt-5 pb-3 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            {titulo}
          </CardTitle>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("px-5 pb-5 sm:px-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

function HeroMetricCard({
  titulo,
  children,
  className,
}: {
  titulo: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        "min-w-[280px] rounded-md border-border/60 bg-card/80 shadow-none backdrop-blur sm:min-w-0",
        className
      )}
    >
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-3 pb-5">{children}</CardContent>
    </Card>
  )
}

function EstadoVazioCard({
  titulo,
  descricao,
  icon,
  action,
}: {
  titulo: string
  descricao: string
  icon: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-4 py-6 text-center">
      <div className="mb-3 flex size-14 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
        {icon}
      </div>
      <p className="text-base font-medium text-foreground">{titulo}</p>
      <p className="mt-1 max-w-[180px] text-xs leading-5 text-muted-foreground">
        {descricao}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function TooltipComparacao({
  active,
  payload,
  label,
  formatarValor,
}: {
  active?: boolean
  payload?: Array<{
    value?: number | null
    dataKey?: string
    payload?: {
      atual?: number | null
      anterior?: number
      principalAnteriorDescricao?: string
      principalAnteriorValor?: number
    }
  }>
  label?: string | number
  formatarValor: (valor: number) => string
}) {
  if (!active || !payload?.length) {
    return null
  }

  const item = payload[0]?.payload
  const atual = item?.atual ?? 0
  const anterior = item?.anterior ?? 0

  return (
    <div className="min-w-[280px] rounded-md border border-border/70 bg-popover/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-lg font-semibold text-foreground">
        Dia {label} - Comparacao
      </p>
      <div className="mt-3 space-y-4">
        <div className="border-t border-border/60 pt-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-md bg-emerald-400" />
            <span className="text-sm text-muted-foreground">Mes atual</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Acumulado:</span>
            <span className="text-[1.75rem] font-semibold text-emerald-400">
              {formatarValor(atual)}
            </span>
          </div>
        </div>

        <div className="border-t border-border/60 pt-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-md bg-slate-400" />
            <span className="text-sm text-muted-foreground">Mes passado</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Acumulado:</span>
            <span className="text-[1.75rem] font-semibold text-slate-300">
              {formatarValor(anterior)}
            </span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Principais transacoes dia:
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-foreground/85">
              {item?.principalAnteriorDescricao ?? "Sem destaque"}
            </span>
            <span className="shrink-0 font-medium text-amber-400">
              {formatarValor(item?.principalAnteriorValor ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TooltipPadrao({
  active,
  payload,
  label,
  formatarValor,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string | number
  formatarValor: (valor: number) => string
}) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-[18px] border border-border/70 bg-popover/95 p-3 shadow-xl backdrop-blur">
      {label ? (
        <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      ) : null}
      <div className="space-y-2">
        {payload.map((item) => (
          <div
            key={`${item.name}-${item.color}`}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-md"
                style={{ backgroundColor: item.color ?? "currentColor" }}
              />
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatarValor(item.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function construirComparacaoAcumulada({
  diaAtual,
  modoComparacao,
  transacoesDoMes,
  transacoesMesAnterior,
}: {
  diaAtual: number
  modoComparacao: ModoComparacao
  transacoesDoMes: Array<{
    data: string
    tipo: "receita" | "despesa" | "transferencia"
    valor: number
  }>
  transacoesMesAnterior: Array<{
    data: string
    tipo: "receita" | "despesa" | "transferencia"
    valor: number
    descricao: string
  }>
}) {
  const atualPorDia = new Map<number, number>()
  const anteriorPorDia = new Map<number, number>()
  const maiorAnteriorPorDia = new Map<
    number,
    { descricao: string; valor: number }
  >()

  transacoesDoMes
    .filter((item) => item.tipo === modoComparacao)
    .forEach((item) => {
      const dia = obterDataLocal(item.data).getDate()
      atualPorDia.set(dia, (atualPorDia.get(dia) ?? 0) + item.valor)
    })

  transacoesMesAnterior
    .filter((item) => item.tipo === modoComparacao)
    .forEach((item) => {
      const dia = obterDataLocal(item.data).getDate()
      anteriorPorDia.set(dia, (anteriorPorDia.get(dia) ?? 0) + item.valor)

      const atual = maiorAnteriorPorDia.get(dia)
      if (!atual || item.valor > atual.valor) {
        maiorAnteriorPorDia.set(dia, {
          descricao: item.descricao,
          valor: item.valor,
        })
      }
    })

  const resultado: Array<{
    dia: string
    atual: number | null
    anterior: number
    principalAnteriorDescricao: string
    principalAnteriorValor: number
  }> = []

  let acumuladoAtual = 0
  let acumuladoAnterior = 0
  let maiorAnteriorCorrente = { descricao: "Sem destaque", valor: 0 }

  for (let indice = 0; indice < 30; indice += 1) {
    const dia = indice + 1

    if (dia <= diaAtual) {
      acumuladoAtual += atualPorDia.get(dia) ?? 0
    }

    acumuladoAnterior += anteriorPorDia.get(dia) ?? 0

    const maiorDoDia = maiorAnteriorPorDia.get(dia)
    if (maiorDoDia && maiorDoDia.valor >= maiorAnteriorCorrente.valor) {
      maiorAnteriorCorrente = maiorDoDia
    }

    resultado.push({
      dia: String(dia),
      atual: dia <= diaAtual ? acumuladoAtual : null,
      anterior: acumuladoAnterior,
      principalAnteriorDescricao: maiorAnteriorCorrente.descricao,
      principalAnteriorValor: maiorAnteriorCorrente.valor,
    })
  }

  return resultado
}

export function PaginaDashboard() {
  const { nome, moeda } = useAuth()
  const navigate = useNavigate()
  const { abrirTransacao } = useTransacaoExplorer()
  const [modoComparacao, setModoComparacao] =
    React.useState<ModoComparacao>("despesa")
  const [mesComparacaoSelecionado, setMesComparacaoSelecionado] =
    React.useState(() => obterChaveMes(new Date()))
  const [configuracaoSecoes, setConfiguracaoSecoes] =
    React.useState<ConfiguracaoSecoes>(lerConfiguracaoSecoes)
  const [ordemDashboard, setOrdemDashboard] =
    React.useState<OrdemDashboard>(lerOrdemDashboard)
  const [tamanhoDashboard, setTamanhoDashboard] =
    React.useState<TamanhoDashboard>(lerTamanhoDashboard)
  const [dragAtivo, setDragAtivo] = React.useState<{
    area: AreaDashboard
    sectionId: SectionId
  } | null>(null)
  const [grupoSelecionado, setGrupoSelecionado] = React.useState("")

  const contasQuery = useQuery({
    queryKey: ["contas"],
    queryFn: listarContasApi,
  })

  const categoriasQuery = useQuery({
    queryKey: ["categorias"],
    queryFn: listarCategoriasApi,
  })

  const transacoesQuery = useQuery({
    queryKey: [
      "transacoes",
      "dashboard",
      contasQuery.data,
      categoriasQuery.data,
    ],
    queryFn: () =>
      listarTransacoesApi(categoriasQuery.data ?? [], contasQuery.data ?? []),
    enabled: Boolean(contasQuery.data && categoriasQuery.data),
  })

  const contas = React.useMemo(() => contasQuery.data ?? [], [contasQuery.data])
  const transacoes = React.useMemo(
    () => transacoesQuery.data ?? [],
    [transacoesQuery.data]
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

  const historicoImportacoesQuery = useQuery({
    queryKey: ["historico-importacao-fatura-dashboard", contasCartaoIds],
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
        new Date(importacao.importadoEm).getTime() >
          new Date(existente.importadoEm).getTime()
      ) {
        mapa.set(chave, importacao)
      }
    })

    return mapa
  }, [historicoImportacoes])

  const agora = React.useMemo(() => new Date(), [])
  const hoje = React.useMemo(
    () => new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()),
    [agora]
  )
  const hojeIso = React.useMemo(() => normalizarIso(hoje), [hoje])
  const anoAtual = agora.getFullYear()
  const mesAtual = agora.getMonth()
  const inicioMesAtual = React.useMemo(
    () => new Date(anoAtual, mesAtual, 1),
    [anoAtual, mesAtual]
  )
  const inicioMesAnterior = React.useMemo(
    () => new Date(anoAtual, mesAtual - 1, 1),
    [anoAtual, mesAtual]
  )

  const primeiroNome = nome?.split(" ").filter(Boolean)[0] ?? "de volta"
  const formatarValor = React.useCallback(
    (valor: number) => formatarMoeda(valor, moeda),
    [moeda]
  )
  const simboloMoeda = React.useMemo(() => obterSimboloMoeda(moeda), [moeda])

  const transacoesOrdenadas = React.useMemo(
    () =>
      [...transacoes].sort(
        (a, b) =>
          obterDataLocal(b.data).getTime() - obterDataLocal(a.data).getTime()
      ),
    [transacoes]
  )

  const mesesDisponiveisComparacao = React.useMemo(() => {
    const meses = new Map<string, Date>()

    meses.set(obterChaveMes(inicioMesAtual), inicioMesAtual)

    transacoes.forEach((item) => {
      const inicioMes = obterInicioMes(obterDataLocal(item.data))
      meses.set(obterChaveMes(inicioMes), inicioMes)
    })

    return Array.from(meses.values()).sort((a, b) => b.getTime() - a.getTime())
  }, [inicioMesAtual, transacoes])

  const chaveMesComparacaoEfetiva =
    mesesDisponiveisComparacao.some(
      (dataMes) => obterChaveMes(dataMes) === mesComparacaoSelecionado
    )
      ? mesComparacaoSelecionado
      : obterChaveMes(mesesDisponiveisComparacao[0] ?? inicioMesAtual)

  const mesComparacaoAtual = React.useMemo(
    () =>
      mesesDisponiveisComparacao.find(
        (dataMes) => obterChaveMes(dataMes) === chaveMesComparacaoEfetiva
      ) ?? inicioMesAtual,
    [chaveMesComparacaoEfetiva, inicioMesAtual, mesesDisponiveisComparacao]
  )

  const mesComparacaoAnterior = React.useMemo(
    () => adicionarMes(mesComparacaoAtual, -1),
    [mesComparacaoAtual]
  )

  const diaAtual = React.useMemo(() => {
    const mesmoMesAtual =
      mesComparacaoAtual.getFullYear() === inicioMesAtual.getFullYear() &&
      mesComparacaoAtual.getMonth() === inicioMesAtual.getMonth()

    return mesmoMesAtual ? Math.min(agora.getDate(), 30) : 30
  }, [agora, inicioMesAtual, mesComparacaoAtual])

  const transacoesDoMes = React.useMemo(
    () =>
      transacoes.filter((item) => {
        const data = obterDataLocal(item.data)
        return data.getFullYear() === anoAtual && data.getMonth() === mesAtual
      }),
    [anoAtual, mesAtual, transacoes]
  )

  const transacoesMesAnterior = React.useMemo(
    () =>
      transacoes.filter((item) => {
        const data = obterDataLocal(item.data)
        return (
          data.getFullYear() === inicioMesAnterior.getFullYear() &&
          data.getMonth() === inicioMesAnterior.getMonth()
        )
      }),
    [inicioMesAnterior, transacoes]
  )

  const transacoesComparacaoMes = React.useMemo(
    () =>
      transacoes.filter((item) => {
        const data = obterDataLocal(item.data)
        return (
          data.getFullYear() === mesComparacaoAtual.getFullYear() &&
          data.getMonth() === mesComparacaoAtual.getMonth()
        )
      }),
    [mesComparacaoAtual, transacoes]
  )

  const transacoesComparacaoMesAnterior = React.useMemo(
    () =>
      transacoes.filter((item) => {
        const data = obterDataLocal(item.data)
        return (
          data.getFullYear() === mesComparacaoAnterior.getFullYear() &&
          data.getMonth() === mesComparacaoAnterior.getMonth()
        )
      }),
    [mesComparacaoAnterior, transacoes]
  )

  const despesas = transacoesDoMes
    .filter((item) => item.tipo === "despesa")
    .reduce((total, item) => total + item.valor, 0)

  const contasComuns = React.useMemo(
    () => contas.filter((conta) => conta.tipo !== "cartao_credito"),
    [contas]
  )
  const saldoEmConta = contasComuns.reduce(
    (total, conta) => total + conta.saldoAtual,
    0
  )
  const contasOrdenadas = React.useMemo(
    () => [...contasComuns].sort((a, b) => b.saldoAtual - a.saldoAtual),
    [contasComuns]
  )

  const saldoPorTipoConta = React.useMemo(() => {
    const mapa = new Map<string, number>()

    contasComuns.forEach((conta) => {
      mapa.set(conta.tipo, (mapa.get(conta.tipo) ?? 0) + conta.saldoAtual)
    })

    return Array.from(mapa.entries())
      .map(([tipo, valor]) => ({
        tipo,
        rotulo: nomesTipoConta[tipo] ?? tipo,
        valor,
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [contasComuns])

  const cartoes = React.useMemo(() => {
    const contasCartao = contas.filter(
      (conta) => conta.tipo === "cartao_credito"
    )

    return contasCartao.map((conta) => {
      const referenciaAtual = obterInicioMes(
        calcularReferenciaFaturaCartao(
          hoje.toISOString().slice(0, 10),
          conta.diaFechamento
        )
      )

      const emUsoAtual = transacoes
        .filter((item) => item.contaId === conta.id)
        .filter((item) => item.tipo !== "transferencia")
        .filter((item) => {
          const referencia = calcularReferenciaFaturaCartao(
            item.data,
            conta.diaFechamento
          )
          return referencia.getTime() >= referenciaAtual.getTime()
        })
        .reduce((total, item) => {
          const impacto = item.tipo === "despesa" ? item.valor : -item.valor
          return total + impacto
        }, 0)

      return {
        id: conta.id,
        nome: conta.nome,
        instituicao: conta.instituicao,
        limite: conta.limiteCredito ?? Math.abs(conta.saldoAtual),
        emUsoAtual: Math.max(emUsoAtual, 0),
      }
    })
  }, [contas, hoje, transacoes])

  const totalFaturas = cartoes.reduce(
    (total, cartao) => total + cartao.emUsoAtual,
    0
  )

  const entradasRecorrentesNoMes = React.useMemo(
    () =>
      transacoesDoMes
        .filter(
          (item) =>
            item.tipo === "receita" &&
            item.recorrente &&
            item.contaTipo !== "cartao_credito"
        )
        .reduce((total, item) => total + item.valor, 0),
    [transacoesDoMes]
  )

  const saidasEmContaNoMes = React.useMemo(
    () =>
      transacoesDoMes
        .filter(
          (item) =>
            item.tipo === "despesa" && item.contaTipo !== "cartao_credito"
        )
        .reduce((total, item) => total + item.valor, 0),
    [transacoesDoMes]
  )

  const contasPrevistasNoMes = React.useMemo(
    () =>
      transacoesDoMes
        .filter((item) => {
          const data = obterDataLocal(item.data)

          return (
            item.tipo === "despesa" &&
            item.contaTipo !== "cartao_credito" &&
            data.getTime() > hoje.getTime()
          )
        })
        .reduce((total, item) => total + item.valor, 0),
    [hoje, transacoesDoMes]
  )

  const valorRecorrenteJaConsumido = Math.min(
    entradasRecorrentesNoMes,
    saidasEmContaNoMes
  )
  const saldoComprometido = totalFaturas + contasPrevistasNoMes
  const saldoLivreEstimado = saldoEmConta - saldoComprometido
  const saldoLivreEstaNegativo = saldoLivreEstimado <= 0
  const resumoSaldoComprometido = React.useMemo(() => {
    if (valorRecorrenteJaConsumido > 0 && saldoLivreEstaNegativo) {
      return `${formatarValor(valorRecorrenteJaConsumido)} do que entrou de recorrente neste mes ja saiu para outras contas, e o saldo atual segue totalmente comprometido.`
    }

    if (valorRecorrenteJaConsumido > 0) {
      return `${formatarValor(valorRecorrenteJaConsumido)} do que entrou de recorrente neste mes ja saiu para outras contas.`
    }

    if (saldoComprometido > 0 && saldoLivreEstaNegativo) {
      return `O saldo atual ja esta totalmente comprometido entre faturas e contas previstas.`
    }

    if (saldoComprometido > 0) {
      return `${formatarValor(saldoComprometido)} do saldo atual ja tem destino entre faturas e contas previstas.`
    }

    return "Nenhum comprometimento extra identificado no dashboard agora."
  }, [
    formatarValor,
    saldoComprometido,
    saldoLivreEstaNegativo,
    valorRecorrenteJaConsumido,
  ])

  const investimentosNacionais = React.useMemo(
    () => contas.filter((conta) => conta.tipo === "investimento"),
    [contas]
  )
  const totalInvestimentosNacionais = investimentosNacionais.reduce(
    (total, conta) => total + conta.saldoAtual,
    0
  )
  const totalInvestimentosInternacionais = 0

  const compromissosFinanceiros = React.useMemo<CompromissoDashboard[]>(() => {
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
          Boolean(transacao.parcelada) ||
          obterStatusPagamentoDashboard(transacao, inicioMesAtual) !== "PAGO"
      )
      .map((transacao) => {
        const dataVencimento =
          transacao.recorrente && transacao.diaRecorrenciaMensal
            ? calcularDataRecorrenteMensal(
                transacao.dataVencimento ?? transacao.data,
                transacao.diaRecorrenciaMensal,
                inicioMesAtual
              )
            : (transacao.dataVencimento ?? transacao.data)
        const statusPagamento = obterStatusPagamentoDashboard(
          transacao,
          inicioMesAtual
        )
        const diasParaVencer =
          statusPagamento === "PAGO"
            ? null
            : Math.ceil(
                (obterDataLocal(dataVencimento).getTime() - hoje.getTime()) /
                  (1000 * 60 * 60 * 24)
              )

        return {
          id: transacao.id,
          titulo: transacao.descricao,
          descricao: transacao.recorrente
            ? "Despesa recorrente monitorada no mes"
            : transacao.parcelada
              ? "Parcela programada com vencimento"
              : "Despesa com compromisso financeiro",
          valor: transacao.valor,
          dataVencimento,
          dataPagamento: transacao.dataPagamento ?? null,
          dataAgendamentoPagamento: transacao.dataAgendamentoPagamento ?? null,
          statusPagamento,
          origem: "despesa" as const,
          contaNome: transacao.conta,
          contaInstituicao: transacao.contaInstituicao,
          recorrente: Boolean(transacao.recorrente),
          parcelada: Boolean(transacao.parcelada),
          vencida: statusPagamento !== "PAGO" && dataVencimento < hojeIso,
          diasParaVencer,
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
      .filter(
        (transacao) =>
          transacao.tipo === "despesa" &&
          transacao.contaTipo === "cartao_credito"
      )
      .forEach((transacao) => {
        const conta = transacao.contaId
          ? contasPorId.get(transacao.contaId)
          : undefined
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

        const referencia = calcularReferenciaFaturaCartao(
          transacao.data,
          conta.diaFechamento
        )
        const chaveReferencia = obterChaveMes(referencia)
        const chaveGrupo = `${conta.id}-${dataVencimento}`
        const grupoAtual = gruposFatura.get(chaveGrupo)

        if (grupoAtual) {
          grupoAtual.itens.push(transacao)
          return
        }

        gruposFatura.set(chaveGrupo, {
          conta,
          dataVencimento,
          referenciaChave: chaveReferencia,
          referenciaDescricao: formatarRotuloMes(referencia),
          itens: [transacao],
        })
      })

    const itensFatura = Array.from(gruposFatura.entries()).map(
      ([chaveGrupo, grupo]) => {
        const valorTransacoes = grupo.itens.reduce(
          (total, item) => total + item.valor,
          0
        )
        const importacaoRelacionada = historicoImportacoesPorChave.get(
          `${grupo.conta.id}-${grupo.referenciaChave}`
        )
        const valorFaturaImportada =
          importacaoRelacionada?.totalFatura ??
          importacaoRelacionada?.valorImportadoPdf ??
          null
        const valor = valorFaturaImportada ?? valorTransacoes
        const todosPagos = grupo.itens.every(
          (item) =>
            obterStatusPagamentoDashboard(item, inicioMesAtual) === "PAGO"
        )
        const existePendente = grupo.itens.some(
          (item) =>
            obterStatusPagamentoDashboard(item, inicioMesAtual) === "PENDENTE"
        )
        const statusPagamento: CompromissoDashboard["statusPagamento"] =
          todosPagos ? "PAGO" : existePendente ? "PENDENTE" : "AGENDADO"
        const datasPagamento = grupo.itens
          .map((item) => item.dataPagamento)
          .filter(Boolean) as string[]
        const datasAgendamento = grupo.itens
          .map((item) => item.dataAgendamentoPagamento)
          .filter(Boolean) as string[]
        const diasParaVencer =
          statusPagamento === "PAGO"
            ? null
            : Math.ceil(
                (obterDataLocal(grupo.dataVencimento).getTime() -
                  hoje.getTime()) /
                  (1000 * 60 * 60 * 24)
              )

        return {
          id: chaveGrupo,
          titulo: `Fatura ${grupo.conta.nome}`,
          descricao: `${grupo.itens.length} compra(s) consolidadas em ${grupo.referenciaDescricao}`,
          valor,
          dataVencimento: grupo.dataVencimento,
          dataPagamento:
            datasPagamento.length > 0
              ? [...datasPagamento].sort((a, b) => b.localeCompare(a))[0]
              : null,
          dataAgendamentoPagamento:
            datasAgendamento.length > 0
              ? [...datasAgendamento].sort((a, b) => a.localeCompare(b))[0]
              : null,
          statusPagamento,
          origem: "fatura_cartao" as const,
          contaNome: grupo.conta.nome,
          contaInstituicao: grupo.conta.instituicao,
          recorrente: true,
          parcelada: grupo.itens.some((item) => item.parcelada),
          vencida: statusPagamento !== "PAGO" && grupo.dataVencimento < hojeIso,
          diasParaVencer,
        }
      }
    )

    return [...itensDespesa, ...itensFatura]
  }, [
    contasPorId,
    historicoImportacoesPorChave,
    hoje,
    hojeIso,
    inicioMesAtual,
    transacoes,
  ])

  const compromissosDoMes = React.useMemo(
    () =>
      compromissosFinanceiros
        .filter((item) => estaNoMesmoMesAno(item.dataVencimento, inicioMesAtual))
        .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento)),
    [compromissosFinanceiros, inicioMesAtual]
  )

  const compromissosPendentesMes = React.useMemo(
    () =>
      compromissosDoMes.filter((item) => item.statusPagamento === "PENDENTE"),
    [compromissosDoMes]
  )
  const compromissosAgendadosMes = React.useMemo(
    () =>
      compromissosDoMes.filter((item) => item.statusPagamento === "AGENDADO"),
    [compromissosDoMes]
  )
  const compromissosPagosMes = React.useMemo(
    () => compromissosDoMes.filter((item) => item.statusPagamento === "PAGO"),
    [compromissosDoMes]
  )
  const compromissosVencidosMes = React.useMemo(
    () => compromissosDoMes.filter((item) => item.vencida),
    [compromissosDoMes]
  )
  const totalPendenciasMes = React.useMemo(
    () =>
      compromissosPendentesMes.reduce((total, item) => total + item.valor, 0),
    [compromissosPendentesMes]
  )
  const totalAgendadoMes = React.useMemo(
    () =>
      compromissosAgendadosMes.reduce((total, item) => total + item.valor, 0),
    [compromissosAgendadosMes]
  )
  const totalPagoMes = React.useMemo(
    () => compromissosPagosMes.reduce((total, item) => total + item.valor, 0),
    [compromissosPagosMes]
  )
  const totalVencidoMes = React.useMemo(
    () =>
      compromissosVencidosMes.reduce((total, item) => total + item.valor, 0),
    [compromissosVencidosMes]
  )
  const recorrenciasDoMes = React.useMemo(
    () =>
      compromissosDoMes.filter(
        (item) => item.origem === "despesa" && (item.recorrente || item.parcelada)
      ),
    [compromissosDoMes]
  )
  const totalRecorrenciasMes = React.useMemo(
    () => recorrenciasDoMes.reduce((total, item) => total + item.valor, 0),
    [recorrenciasDoMes]
  )
  const proximosCompromissos = React.useMemo(() => {
    const candidatos = compromissosFinanceiros
      .filter((item) => item.statusPagamento !== "PAGO")
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))

    const prioritarios = candidatos.filter(
      (item) =>
        item.vencida ||
        (item.diasParaVencer !== null && item.diasParaVencer <= 15)
    )

    return (prioritarios.length > 0 ? prioritarios : candidatos).slice(0, 5)
  }, [compromissosFinanceiros])
  const compromissosDosProximos7Dias = React.useMemo(
    () =>
      compromissosFinanceiros
        .filter((item) => item.statusPagamento !== "PAGO")
        .filter(
          (item) =>
            item.diasParaVencer !== null &&
            item.diasParaVencer >= 0 &&
            item.diasParaVencer <= 7
        ),
    [compromissosFinanceiros]
  )
  const saidaProximos7Dias = React.useMemo(
    () =>
      compromissosDosProximos7Dias.reduce((total, item) => total + item.valor, 0),
    [compromissosDosProximos7Dias]
  )
  const saldoProjetado7Dias = saldoEmConta - saidaProximos7Dias
  const resumoExecucaoMes = React.useMemo(() => {
    if (compromissosVencidosMes.length > 0) {
      return {
        titulo: `${compromissosVencidosMes.length} vencimento(s) pedem acao imediata`,
        descricao: `${formatarValor(totalVencidoMes)} ja passou da data e pode pressionar seu caixa ou gerar encargos.`,
        classe: "border-destructive/25 bg-destructive/5",
      }
    }

    const alertas = compromissosDoMes.filter(
      (item) =>
        item.statusPagamento !== "PAGO" &&
        item.diasParaVencer !== null &&
        item.diasParaVencer >= 0 &&
        item.diasParaVencer <= 2
    )

    if (alertas.length > 0) {
      return {
        titulo: `${alertas.length} compromisso(s) vencem nos proximos 2 dias`,
        descricao: `${formatarValor(alertas.reduce((total, item) => total + item.valor, 0))} ainda precisa de definicao entre pagar ou agendar.`,
        classe: "border-amber-500/25 bg-amber-500/5",
      }
    }

    if (compromissosPendentesMes.length > 0) {
      return {
        titulo: "Seu mes esta organizado, mas ainda aberto",
        descricao: `${formatarValor(totalPendenciasMes)} segue como a pagar e ${formatarValor(totalAgendadoMes)} ja esta programado.`,
        classe: "border-primary/20 bg-primary/5",
      }
    }

    return {
      titulo: "Compromissos do mes sob controle",
      descricao: "Tudo que venceu neste periodo ja foi pago ou esta devidamente programado.",
      classe: "border-emerald-500/25 bg-emerald-500/5",
    }
  }, [
    compromissosDoMes,
    compromissosPendentesMes,
    compromissosVencidosMes,
    formatarValor,
    totalAgendadoMes,
    totalPendenciasMes,
    totalVencidoMes,
  ])

  const transacoesParaRevisarBase = React.useMemo(
    () =>
      transacoesOrdenadas.filter(
        (item) => {
          const categoriaNormalizada = normalizarTexto(item.categoria)
          const observacaoNormalizada = normalizarTexto(item.observacao)

          if (!item.categoriaId || !item.categoria || categoriaNormalizada === "sem categoria") {
            return true
          }

          if (categoriaNormalizada === CATEGORIA_REVISAO_IA) {
            return true
          }

          return (
            categoriaNormalizada === CATEGORIA_FALLBACK_IMPORTACAO_IA &&
            observacaoNormalizada.includes("importado da fatura")
          )
        }
      ),
    [transacoesOrdenadas]
  )

  const transacoesParaRevisar = React.useMemo(
    () => transacoesParaRevisarBase.slice(0, 6),
    [transacoesParaRevisarBase]
  )

  const gastosPorCategoria = React.useMemo(() => {
    const mapa = new Map<string, number>()
    const total = transacoesDoMes
      .filter((item) => item.tipo === "despesa")
      .reduce((acc, item) => {
        const categoria = item.categoria || "Sem categoria"
        mapa.set(categoria, (mapa.get(categoria) ?? 0) + item.valor)
        return acc + item.valor
      }, 0)

    return Array.from(mapa.entries())
      .map(([categoria, valor], indice) => {
        const config = obterConfigDaCategoria(categoria, indice)
        return {
          categoria,
          valor,
          percentual: total > 0 ? Math.round((valor / total) * 100) : 0,
          cor: config.cor,
          emoji: config.emoji,
        }
      })
      .sort((a, b) => b.valor - a.valor)
  }, [transacoesDoMes])

  const categoriasPrincipais = React.useMemo(() => {
    const atualMap = new Map<string, number>()
    const anteriorMap = new Map<string, number>()

    transacoesDoMes
      .filter((item) => item.tipo === "despesa")
      .forEach((item) => {
        const categoria = item.categoria || "Sem categoria"
        atualMap.set(categoria, (atualMap.get(categoria) ?? 0) + item.valor)
      })

    transacoesMesAnterior
      .filter((item) => item.tipo === "despesa")
      .forEach((item) => {
        const categoria = item.categoria || "Sem categoria"
        anteriorMap.set(
          categoria,
          (anteriorMap.get(categoria) ?? 0) + item.valor
        )
      })

    const maiorValorAtual = Math.max(...Array.from(atualMap.values()), 0)

    return Array.from(atualMap.entries())
      .map(([categoria, valor], indice) => {
        const anterior = anteriorMap.get(categoria) ?? 0
        const variacao =
          anterior > 0 ? ((valor - anterior) / anterior) * 100 : null
        const config = obterConfigDaCategoria(categoria, indice)

        return {
          categoria,
          valor,
          anterior,
          variacao,
          barra: maiorValorAtual > 0 ? (valor / maiorValorAtual) * 100 : 0,
          cor: config.cor,
          emoji: config.emoji,
        }
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
  }, [transacoesDoMes, transacoesMesAnterior])

  const gruposDisponiveis = React.useMemo(() => {
    const grupos = new Set<string>()

    transacoes
      .filter((item) => item.tipo === "despesa")
      .forEach((item) => {
        grupos.add(item.categoriaGrupo || item.categoria || "Sem grupo")
      })

    return Array.from(grupos)
  }, [transacoes])

  const grupoEfetivo =
    grupoSelecionado && gruposDisponiveis.includes(grupoSelecionado)
      ? grupoSelecionado
      : (gruposDisponiveis[0] ?? "")

  const serieGrupoSelecionado = React.useMemo(() => {
    if (!grupoEfetivo) {
      return []
    }

    const inicio = adicionarMes(obterInicioMes(hoje), -5)

    return Array.from({ length: 6 }, (_, indice) => {
      const dataMes = adicionarMes(inicio, indice)
      const inicioMes = obterInicioMes(dataMes)
      const total = transacoes
        .filter((item) => {
          const data = obterDataLocal(item.data)
          return (
            item.tipo === "despesa" &&
            (item.categoriaGrupo || item.categoria || "Sem grupo") ===
              grupoEfetivo &&
            data.getFullYear() === inicioMes.getFullYear() &&
            data.getMonth() === inicioMes.getMonth()
          )
        })
        .reduce((acc, item) => acc + item.valor, 0)

      return {
        mes: formatarRotuloMes(dataMes),
        valor: total,
      }
    })
  }, [grupoEfetivo, hoje, transacoes])

  const categoriasStack = React.useMemo(() => {
    const inicio = adicionarMes(obterInicioMes(hoje), -5)
    const mapaCategorias = new Map<string, number>()

    transacoes
      .filter((item) => item.tipo === "despesa")
      .forEach((item) => {
        const data = obterDataLocal(item.data)
        if (data.getTime() < inicio.getTime()) {
          return
        }

        const categoria = item.categoria || "Sem categoria"
        mapaCategorias.set(
          categoria,
          (mapaCategorias.get(categoria) ?? 0) + item.valor
        )
      })

    return Array.from(mapaCategorias.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([categoria]) => categoria)
  }, [hoje, transacoes])

  const despesasPorGrupoMensal = React.useMemo(() => {
    const inicio = adicionarMes(obterInicioMes(hoje), -5)

    return Array.from({ length: 6 }, (_, indice) => {
      const dataMes = adicionarMes(inicio, indice)
      const itemBase: Record<string, string | number> = {
        mes: formatarRotuloMes(dataMes),
      }

      categoriasStack.forEach((categoria) => {
        itemBase[categoria] = 0
      })

      transacoes
        .filter((transacao) => transacao.tipo === "despesa")
        .forEach((transacao) => {
          const data = obterDataLocal(transacao.data)
          if (
            data.getFullYear() !== dataMes.getFullYear() ||
            data.getMonth() !== dataMes.getMonth()
          ) {
            return
          }

          const categoria = transacao.categoria || "Sem categoria"
          if (!categoriasStack.includes(categoria)) {
            return
          }

          itemBase[categoria] =
            Number(itemBase[categoria] ?? 0) + transacao.valor
        })

      return itemBase
    })
  }, [categoriasStack, hoje, transacoes])

  const comparacaoAcumulada = React.useMemo(() => {
    return construirComparacaoAcumulada({
      diaAtual,
      modoComparacao,
      transacoesDoMes: transacoesComparacaoMes,
      transacoesMesAnterior: transacoesComparacaoMesAnterior,
    })
  }, [
    diaAtual,
    modoComparacao,
    transacoesComparacaoMes,
    transacoesComparacaoMesAnterior,
  ])

  const valorAtualComparacao =
    [...comparacaoAcumulada].reverse().find((item) => item.atual !== null)
      ?.atual ?? 0
  const valorAnteriorComparacao =
    comparacaoAcumulada[diaAtual - 1]?.anterior ?? 0
  const variacaoComparacao =
    valorAnteriorComparacao > 0
      ? ((valorAtualComparacao - valorAnteriorComparacao) /
          valorAnteriorComparacao) *
        100
      : null

  const comparacaoFavoravel =
    modoComparacao === "despesa"
      ? valorAtualComparacao <= valorAnteriorComparacao
      : valorAtualComparacao >= valorAnteriorComparacao

  const diferencaComparacao = Math.abs(
    valorAnteriorComparacao - valorAtualComparacao
  )
  const rotuloMesAtualComparacao = formatarRotuloMes(mesComparacaoAtual)
  const rotuloMesAnteriorComparacao = formatarRotuloMes(mesComparacaoAnterior)
  const tituloComparacao =
    modoComparacao === "despesa"
      ? "Comparacao Gastos Acumulados 30 dias"
      : "Comparacao Receitas Acumuladas 30 dias"

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      CHAVE_VISIBILIDADE_DASHBOARD,
      JSON.stringify(configuracaoSecoes)
    )
  }, [configuracaoSecoes])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      CHAVE_ORDEM_DASHBOARD,
      JSON.stringify(ordemDashboard)
    )
  }, [ordemDashboard])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      CHAVE_TAMANHO_DASHBOARD,
      JSON.stringify(tamanhoDashboard)
    )
  }, [tamanhoDashboard])

  const secoesHeroVisiveis = ordemDashboard.hero.filter(
    (id) => configuracaoSecoes[id]
  )
  const secoesDetalheVisiveis = ordemDashboard.detail.filter(
    (id) => configuracaoSecoes[id]
  )
  const ordemHeroMap = React.useMemo(
    () =>
      new Map(
        ordemDashboard.hero.map((sectionId, indice) => [sectionId, indice] as const)
      ),
    [ordemDashboard.hero]
  )
  const ordemDetalheMap = React.useMemo(
    () =>
      new Map(
        ordemDashboard.detail.map((sectionId, indice) => [sectionId, indice] as const)
      ),
    [ordemDashboard.detail]
  )
  const totalWidgetsAtivos = secoesConfiguraveis.filter(
    ({ id }) => configuracaoSecoes[id]
  ).length

  function handleDragStart(area: AreaDashboard, sectionId: SectionId) {
    setDragAtivo({ area, sectionId })
  }

  function handleDragEnd() {
    setDragAtivo(null)
  }

  function handleDrop(area: AreaDashboard, destinoId: SectionId) {
    if (!dragAtivo || dragAtivo.area !== area || dragAtivo.sectionId === destinoId) {
      setDragAtivo(null)
      return
    }

    setOrdemDashboard((atual) => {
      const origem = atual[area]
      const semOrigem = origem.filter((item) => item !== dragAtivo.sectionId)
      const indiceDestino = semOrigem.indexOf(destinoId)
      const proximaOrdem = [...semOrigem]
      proximaOrdem.splice(indiceDestino, 0, dragAtivo.sectionId)

      return {
        ...atual,
        [area]: proximaOrdem,
      }
    })
    setDragAtivo(null)
  }

  function handleAlternarTamanho(sectionId: SectionId) {
    setTamanhoDashboard((atual) => ({
      ...atual,
      [sectionId]: atual[sectionId] === "largo" ? "padrao" : "largo",
    }))
  }

  const cardsHero: Record<SectionId, React.ReactNode> = {
    saldo: (
      <HeroMetricCard titulo="Saldo em Conta">
        <div className="space-y-4">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {formatarValor(saldoEmConta)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {contasComuns.length} contas • Atualizado agora
            </p>
          </div>

          <div
            className={cn(
              "rounded-lg border px-3 py-3",
              saldoLivreEstaNegativo
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-emerald-500/30 bg-emerald-500/5"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Saldo livre
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatarValor(saldoLivreEstimado)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Comprometido
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatarValor(saldoComprometido)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {resumoSaldoComprometido}
            </p>
          </div>

          <div className="max-h-[240px] space-y-3 overflow-y-auto border-t border-border/40 pt-3 pr-1">
            {contasOrdenadas.map((conta) => (
              <div
                key={conta.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <LogoBanco instituicao={conta.instituicao} tamanho="sm" />
                  <span className="truncate text-sm text-foreground/85">
                    {conta.instituicao}
                  </span>
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {formatarValor(conta.saldoAtual)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t border-border/40 pt-3">
            {saldoPorTipoConta.slice(0, 2).map((item) => (
              <div
                key={item.tipo}
                className="flex items-center justify-between px-2 py-1 text-xs"
              >
                <span className="text-muted-foreground">{item.rotulo}</span>
                <span className="font-medium text-muted-foreground tabular-nums">
                  {formatarValor(item.valor)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-border/40 pt-2">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm font-semibold text-foreground">
                Total
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatarValor(saldoEmConta)}
              </span>
            </div>
          </div>
        </div>
      </HeroMetricCard>
    ),
    faturas: (
      <HeroMetricCard titulo="Faturas de Cartao">
        {cartoes.length === 0 ? (
          <EstadoVazioCard
            titulo="Nenhum cartao"
            descricao="Conecte seus cartoes de credito para ver suas faturas"
            icon={<IconCreditCard className="size-6" />}
          />
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatarValor(totalFaturas)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cartoes.length} cartoes monitorados no uso atual do limite
              </p>
            </div>
            <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
            {cartoes.map((cartao) => {
              const percentual =
                cartao.limite > 0
                  ? (cartao.emUsoAtual / cartao.limite) * 100
                  : 0

              return (
                <div
                  key={cartao.id}
                  className="rounded-md border border-border/50 bg-muted/10 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {cartao.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(percentual)}% do limite em uso
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatarValor(cartao.emUsoAtual)}
                    </span>
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        )}
      </HeroMetricCard>
    ),
    "investimentos-nacionais": (
      <HeroMetricCard titulo={investimentosNacionais.length > 0 ? "Investimentos Nacionais" : "Agenda do Mes"}>
        {investimentosNacionais.length === 0 ? (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatarValor(totalPendenciasMes + totalAgendadoMes)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {compromissosDoMes.filter((item) => item.statusPagamento !== "PAGO").length} compromisso(s) ainda dependem de voce neste mes
              </p>
            </div>

            <div className={cn("rounded-lg border px-3 py-3", resumoExecucaoMes.classe)}>
              <p className="text-sm font-semibold text-foreground">
                {resumoExecucaoMes.titulo}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {resumoExecucaoMes.descricao}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-300/80">
                  A pagar
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatarValor(totalPendenciasMes)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {compromissosPendentesMes.length} item(ns)
                </p>
              </div>
              <div className="rounded-md border border-slate-500/20 bg-slate-500/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                  Agendado
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatarValor(totalAgendadoMes)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {compromissosAgendadosMes.length} item(ns)
                </p>
              </div>
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  Pago
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatarValor(totalPagoMes)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {compromissosPagosMes.length} item(ns)
                </p>
              </div>
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-destructive/85">
                  Vencido
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatarValor(totalVencidoMes)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {compromissosVencidosMes.length} item(ns)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
              <Button
                size="sm"
                className="h-9 rounded-md"
                onClick={() => navigate("/agenda-financeira")}
              >
                <IconCalendarMonth className="size-4" />
                Abrir agenda
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-md"
                onClick={() => navigate("/transacoes")}
              >
                <IconReceipt2 className="size-4" />
                Ver transacoes
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatarValor(totalInvestimentosNacionais)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {investimentosNacionais.length} contas de investimento
              </p>
            </div>
            {investimentosNacionais.slice(0, 3).map((conta) => (
              <div
                key={conta.id}
                className="rounded-md border border-border/50 bg-muted/10 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <LogoBanco instituicao={conta.instituicao} tamanho="sm" />
                    <span className="truncate text-sm text-foreground/85">
                      {conta.nome}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatarValor(conta.saldoAtual)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </HeroMetricCard>
    ),
    "investimentos-internacionais": (
      <HeroMetricCard titulo={totalInvestimentosInternacionais > 0 ? "Investimentos Internacionais" : "Proximos Vencimentos"}>
        {totalInvestimentosInternacionais === 0 ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {formatarValor(saidaProximos7Dias)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sai do caixa nos proximos 7 dias
                </p>
              </div>
              <Badge
                variant={saldoProjetado7Dias < 0 ? "destructive" : "success"}
                className="mt-1"
              >
                Saldo projetado {formatarValor(saldoProjetado7Dias)}
              </Badge>
            </div>

            {proximosCompromissos.length === 0 ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-4">
                <p className="text-sm font-semibold text-foreground">
                  Nada urgente no radar
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Nenhum vencimento aberto apareceu nos proximos dias. Sua agenda do mes esta leve neste momento.
                </p>
              </div>
            ) : (
              <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                {proximosCompromissos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/10 p-3 text-left transition-colors hover:bg-muted/30"
                    onClick={() => navigate("/agenda-financeira")}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.titulo}
                        </p>
                        <Badge variant={obterVariantCompromisso(item)}>
                          {obterRotuloCompromisso(item)}
                        </Badge>
                        {item.origem === "fatura_cartao" ? (
                          <Badge variant="outline">Fatura</Badge>
                        ) : null}
                        {item.recorrente ? (
                          <Badge variant="secondary">Recorrente</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.contaNome}
                        <span className="mx-1.5 opacity-40">•</span>
                        Vence em {formatarData(item.dataVencimento)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {formatarValor(item.valor)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {formatarValor(totalInvestimentosInternacionais)}
            </p>
          </div>
        )}
      </HeroMetricCard>
    ),
    comparacao: null,
    categorias: null,
    orcamento: null,
    revisar: null,
    transacoes: null,
    "principais-categorias": null,
    "evolucao-grupo": null,
    "despesas-grupo": null,
  }

  return (
    <div className="space-y-6 bg-background px-6 py-6 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-lg font-semibold text-foreground/85">
            Bem vindo de volta, {primeiroNome}!
          </span>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-11 rounded-md border-border/70 bg-background px-4 shadow-sm"
            >
              <IconLayoutGrid className="size-4" />
              Customizar
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                {totalWidgetsAtivos}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={10}
            className="z-[99999] w-72 p-0"
          >
            <div className="border-b border-border p-3">
              <h3 className="text-sm font-medium text-foreground">
                Widgets do Dashboard
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Escolha quais widgets exibir
              </p>
            </div>

            <div className="max-h-[320px] space-y-0.5 overflow-y-auto p-2">
              {secoesConfiguraveis.map((secao) => (
                <label
                  key={secao.id}
                  htmlFor={`widget-${secao.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id={`widget-${secao.id}`}
                    checked={configuracaoSecoes[secao.id]}
                    onCheckedChange={(checked) =>
                      setConfiguracaoSecoes((atual) => ({
                        ...atual,
                        [secao.id]: checked === true,
                      }))
                    }
                    aria-label={`Alternar ${secao.titulo}`}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight text-foreground">
                      {secao.titulo}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {secao.descricao}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {transacoesQuery.isError ? (
        <Card className="rounded-[20px] border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Nao foi possivel carregar o dashboard completamente agora. Os blocos
            abaixo continuam usando os dados disponiveis.
          </CardContent>
        </Card>
      ) : null}

      {secoesHeroVisiveis.length > 0 ? (
        <section>
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            }}
          >
            {secoesHeroVisiveis.map((sectionId) => (
              <DashboardOrdenavelSlot
                key={sectionId}
                area="hero"
                sectionId={sectionId}
                order={ordemHeroMap.get(sectionId) ?? 0}
                dragAtivo={dragAtivo}
                tamanho={tamanhoDashboard[sectionId]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                {cardsHero[sectionId]}
              </DashboardOrdenavelSlot>
            ))}
          </div>
        </section>
      ) : null}

      {secoesDetalheVisiveis.length > 0 ? (
        <section className="grid gap-5 xl:grid-cols-3">
          {configuracaoSecoes.comparacao ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="comparacao"
              order={ordemDetalheMap.get("comparacao") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard.comparacao}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className={obterClasseTamanhoCard("detail", tamanhoDashboard.comparacao)}
            >
              <CardBase
                titulo={tituloComparacao}
                action={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Select
                      value={chaveMesComparacaoEfetiva}
                      onValueChange={setMesComparacaoSelecionado}
                    >
                      <SelectTrigger className="h-9 w-[140px] rounded-md border-border/60 bg-background/60">
                        <SelectValue placeholder="Selecione o mes" />
                      </SelectTrigger>
                      <SelectContent>
                        {mesesDisponiveisComparacao.map((dataMes) => {
                          const chaveMes = obterChaveMes(dataMes)
                          return (
                            <SelectItem key={chaveMes} value={chaveMes}>
                              {formatarRotuloMes(dataMes)}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <div className="inline-flex rounded-md border border-border/60 bg-background/60 p-1">
                      <button
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                          modoComparacao === "despesa"
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setModoComparacao("despesa")}
                      >
                        Despesa
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                          modoComparacao === "receita"
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setModoComparacao("receita")}
                      >
                        Receita
                      </button>
                    </div>
                  </div>
                }
              >
                <div className="space-y-5">
                  <div>
                    <p className="text-4xl font-semibold tracking-tight text-foreground">
                      {formatarValor(valorAtualComparacao)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rotuloMesAtualComparacao} vs {rotuloMesAnteriorComparacao}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "font-semibold",
                          comparacaoFavoravel
                            ? "text-emerald-400"
                            : "text-destructive"
                        )}
                      >
                        {formatarPercentual(variacaoComparacao ?? 0)}
                      </span>
                      <span className="text-muted-foreground">
                        vs {formatarValor(valorAnteriorComparacao)} em{" "}
                        {rotuloMesAnteriorComparacao}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-sm",
                        comparacaoFavoravel
                          ? "text-emerald-400"
                          : "text-destructive"
                      )}
                    >
                      {modoComparacao === "despesa"
                        ? comparacaoFavoravel
                          ? `Economizou ${formatarValor(diferencaComparacao)}`
                          : `Gastou ${formatarValor(diferencaComparacao)} a mais`
                        : comparacaoFavoravel
                          ? `Cresceu ${formatarValor(diferencaComparacao)}`
                          : `Recebeu ${formatarValor(diferencaComparacao)} a menos`}
                    </p>
                  </div>

                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparacaoAcumulada}>
                        <CartesianGrid
                          stroke="rgba(148,163,184,0.08)"
                          strokeDasharray="3 6"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="dia"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: "var(--color-muted-foreground)",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: "var(--color-muted-foreground)",
                            fontSize: 12,
                          }}
                          tickFormatter={(valor) => `${simboloMoeda} ${valor}`}
                        />
                        <Tooltip
                          cursor={{
                            stroke: "rgba(255,255,255,0.5)",
                            strokeWidth: 1,
                          }}
                          content={
                            <TooltipComparacao formatarValor={formatarValor} />
                          }
                        />
                        <ReferenceLine
                          x={String(diaAtual)}
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth={1}
                        />
                        <Line
                          type="monotone"
                          dataKey="atual"
                          stroke="#36E58A"
                          strokeWidth={3}
                          dot={false}
                          connectNulls={false}
                          activeDot={{
                            r: 6,
                            fill: "#36E58A",
                            stroke: "#ffffff",
                            strokeWidth: 2,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="anterior"
                          stroke="#7E8799"
                          strokeDasharray="8 6"
                          strokeWidth={2.4}
                          dot={false}
                          activeDot={{
                            r: 5,
                            fill: "#7E8799",
                            stroke: "#ffffff",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-md bg-emerald-400" />
                      <span>Mes atual</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-md bg-slate-400" />
                      <span>Mes passado</span>
                    </div>
                  </div>
                </div>
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}

          {configuracaoSecoes.categorias ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="categorias"
              order={ordemDetalheMap.get("categorias") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard.categorias}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <CardBase titulo="Gastos por Categoria">
                <div className="space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="relative h-[220px] w-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gastosPorCategoria}
                          dataKey="valor"
                          nameKey="categoria"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {gastosPorCategoria.map((item) => (
                            <Cell key={item.categoria} fill={item.cor} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={
                            <TooltipPadrao formatarValor={formatarValor} />
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        Total
                      </span>
                      <span className="text-4xl font-semibold text-foreground">
                        {despesas >= 1000
                          ? `${simboloMoeda} ${(despesas / 1000).toFixed(1)}K`
                          : formatarValor(despesas)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {gastosPorCategoria.slice(0, 5).map((item) => (
                    <div
                      key={item.categoria}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{item.emoji}</span>
                        <span
                          className="size-2 rounded-md"
                          style={{ backgroundColor: item.cor }}
                        />
                      </div>
                      <span className="flex-1 truncate text-sm text-foreground/90">
                        {item.categoria}
                      </span>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-medium text-foreground">
                          {formatarValor(item.valor)}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.percentual}%
                        </span>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="w-full py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Ver todas as {gastosPorCategoria.length} categorias →
                  </button>
                </div>
                </div>
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}

          {configuracaoSecoes.orcamento ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="orcamento"
              order={ordemDetalheMap.get("orcamento") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard.orcamento}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <CardBase
                titulo="Planner do Mes"
                action={
                  <button
                    type="button"
                    className="text-xs font-medium tracking-wide text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                    onClick={() => navigate("/agenda-financeira")}
                  >
                    ABRIR AGENDA →
                  </button>
                }
              >
                <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <IconCalendarMonth className="size-4 text-primary" />
                      Proximos 7 dias
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatarValor(saidaProximos7Dias)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {compromissosDosProximos7Dias.length} compromisso(s) com impacto imediato no caixa.
                    </p>
                  </div>

                  <div className="rounded-md border border-border/60 bg-muted/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <IconRepeat className="size-4 text-primary" />
                      Fixas e recorrentes
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatarValor(totalRecorrenciasMes)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recorrenciasDoMes.length} item(ns) previsiveis no periodo atual.
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-card/40 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <IconTarget className="size-4 text-primary" />
                    Passos sugeridos
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-start gap-3 rounded-md bg-muted/20 px-3 py-2.5">
                      <span className="mt-0.5">
                        <IconAlertTriangle className="size-4 text-destructive" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Resolver atrasos primeiro
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {compromissosVencidosMes.length} item(ns) vencido(s) somando {formatarValor(totalVencidoMes)}.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-md bg-muted/20 px-3 py-2.5">
                      <span className="mt-0.5">
                        <IconClock className="size-4 text-amber-600" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Confirmar pagamentos pendentes
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {compromissosPendentesMes.length} item(ns) ainda estao como a pagar e podem ser agendados ou quitados.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-md bg-muted/20 px-3 py-2.5">
                      <span className="mt-0.5">
                        <IconCheck className="size-4 text-emerald-600" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Sustentar o saldo projetado
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Depois dos proximos vencimentos, seu saldo estimado fica em {formatarValor(saldoProjetado7Dias)}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {recorrenciasDoMes.slice(0, 4).map((item) => (
                    <div
                      key={`planner-${item.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.titulo}
                          </p>
                          <Badge variant={obterVariantCompromisso(item)}>
                            {obterRotuloCompromisso(item)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.contaNome}
                          <span className="mx-1.5 opacity-40">•</span>
                          {formatarData(item.dataVencimento)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatarValor(item.valor)}
                      </span>
                    </div>
                  ))}
                </div>
                </div>
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}

          {configuracaoSecoes.revisar ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="revisar"
              order={ordemDetalheMap.get("revisar") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard.revisar}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <CardBase
                titulo={
                  <div className="flex items-center gap-2.5">
                    <span>Para Revisar</span>
                    <span className="inline-flex min-w-[22px] items-center justify-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {transacoesParaRevisarBase.length}
                    </span>
                  </div>
                }
                action={
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    onClick={() => navigate("/transacoes")}
                  >
                    <span>Ver todas</span>
                    <IconChevronRight className="size-4" />
                  </button>
                }
              >
                <p className="mb-3 text-[13px] text-muted-foreground">
                  Revise as categorias que a IA deixou pendentes ou muito genericas
                </p>
                {transacoesParaRevisar.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                    Nenhuma transacao importada pela IA esta aguardando revisao agora.
                  </div>
                ) : (
                  <div className="-mx-2 space-y-0.5">
                    {transacoesParaRevisar.map((item) => (
                      <button
                        key={`revisar-${item.id}`}
                        type="button"
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all hover:bg-amber-50/70 dark:hover:bg-amber-900/15"
                        onClick={() => abrirTransacao(item.id)}
                      >
                        <div className="relative shrink-0">
                          <div className="flex size-10 items-center justify-center rounded-md bg-muted/40 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                            <LogoBanco
                              instituicao={item.contaInstituicao}
                              tamanho="sm"
                            />
                          </div>
                          <div className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-md bg-amber-400 ring-2 ring-background">
                            <span className="size-1.5 rounded-md bg-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="truncate text-[14px] leading-snug font-medium text-foreground">
                            {item.descricao}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                            {item.conta}
                            <span className="mx-1.5 opacity-40">·</span>
                            {formatarData(item.data)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <p
                              className={cn(
                                "text-[14px] font-semibold tracking-tight",
                                item.tipo === "receita"
                                  ? "text-emerald-500"
                                  : "text-foreground"
                              )}
                            >
                              {item.tipo === "receita" ? "+" : "-"}{" "}
                              {formatarValor(item.valor)}
                            </p>
                          </div>
                          <IconChevronRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}

          {configuracaoSecoes.transacoes ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="transacoes"
              order={ordemDetalheMap.get("transacoes") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard.transacoes}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <CardBase
                titulo="Transacoes"
                action={
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                  >
                    Todas transacoes →
                  </button>
                }
              >
                <p className="mb-3 text-[13px] text-muted-foreground">
                  Mais recentes
                </p>
                <div className="space-y-2">
                  {transacoesOrdenadas.slice(0, 5).map((item) => (
                    <div
                      key={`transacao-${item.id}`}
                      className="flex items-center justify-between gap-3 rounded-md py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <LogoBanco
                          instituicao={item.contaInstituicao}
                          tamanho="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.descricao}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.categoria}
                            <span className="mx-1.5 opacity-40">·</span>
                            {formatarData(item.data)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold",
                          item.tipo === "receita"
                            ? "text-emerald-500"
                            : "text-destructive"
                        )}
                      >
                        {item.tipo === "receita" ? "+" : "-"}
                        {formatarValor(item.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}

          {configuracaoSecoes["principais-categorias"] ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="principais-categorias"
              order={ordemDetalheMap.get("principais-categorias") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard["principais-categorias"]}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className={obterClasseTamanhoCard(
                "detail",
                tamanhoDashboard["principais-categorias"]
              )}
            >
              <CardBase
                titulo="PRINCIPAIS CATEGORIAS"
                action={
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                  >
                    Ver mais
                    <IconChevronRight className="size-3.5" />
                  </button>
                }
              >
                <div className="space-y-2">
                <div className="grid grid-cols-[minmax(0,1.5fr)_110px_minmax(160px,1fr)_82px_90px] gap-4 px-4 pb-2 text-[11px] text-muted-foreground">
                  <span>Categoria</span>
                  <span className="text-right">Atual</span>
                  <span>vs Anterior</span>
                  <span className="text-right">Var.</span>
                  <span className="text-right">Anterior</span>
                </div>

                {categoriasPrincipais.map((item) => (
                  <div
                    key={item.categoria}
                    className="grid grid-cols-[minmax(0,1.5fr)_110px_minmax(160px,1fr)_82px_90px] items-center gap-4 rounded-md px-4 py-2.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="size-2.5 rounded-md"
                        style={{ backgroundColor: item.cor }}
                      />
                      <span className="shrink-0 text-sm">{item.emoji}</span>
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.categoria}
                      </span>
                    </div>

                    <div className="text-right text-sm font-semibold text-foreground">
                      {formatarValor(item.valor)}
                    </div>

                    <div className="h-3 rounded-md bg-muted/50">
                      <div
                        className={cn(
                          "h-full rounded-md",
                          item.variacao !== null && item.variacao > 0
                            ? "bg-red-500"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.max(item.barra, 6)}%` }}
                      />
                    </div>

                    <div className="text-right">
                      <Badge variant={variantPorVariacao(item.variacao)}>
                        {item.variacao === null
                          ? "novo"
                          : formatarPercentual(item.variacao)}
                      </Badge>
                    </div>

                    <div className="text-right text-sm text-muted-foreground">
                      {item.anterior > 0 ? formatarValor(item.anterior) : "--"}
                    </div>
                  </div>
                ))}
                </div>
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}

          {configuracaoSecoes["evolucao-grupo"] ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="evolucao-grupo"
              order={ordemDetalheMap.get("evolucao-grupo") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard["evolucao-grupo"]}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <CardBase
                titulo="Evolucao por Grupo"
                action={
                  <Select
                    value={grupoEfetivo || "__vazio__"}
                    onValueChange={setGrupoSelecionado}
                  >
                    <SelectTrigger className="h-10 w-[170px] rounded-md border-border/60 bg-background/60">
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {gruposDisponiveis.length === 0 ? (
                        <SelectItem value="__vazio__" disabled>
                          Nenhum grupo
                        </SelectItem>
                      ) : (
                        gruposDisponiveis.map((grupo) => (
                          <SelectItem key={grupo} value={grupo}>
                            {grupo}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                }
              >
                {grupoEfetivo ? (
                  <div className="space-y-4">
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={serieGrupoSelecionado}>
                          <CartesianGrid
                            stroke="rgba(148,163,184,0.08)"
                            strokeDasharray="3 6"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="mes"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                              fill: "var(--color-muted-foreground)",
                              fontSize: 12,
                            }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{
                              fill: "var(--color-muted-foreground)",
                              fontSize: 12,
                            }}
                            tickFormatter={(valor) => `${simboloMoeda} ${valor}`}
                          />
                          <Tooltip
                            content={
                              <TooltipPadrao formatarValor={formatarValor} />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="valor"
                            stroke="#36E58A"
                            fill="rgba(54,229,138,0.18)"
                            strokeWidth={2.5}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[300px] items-center justify-center text-center text-muted-foreground">
                    Selecione um grupo para ver a evolucao
                  </div>
                )}
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}

          {configuracaoSecoes["despesas-grupo"] ? (
            <DashboardOrdenavelSlot
              area="detail"
              sectionId="despesas-grupo"
              order={ordemDetalheMap.get("despesas-grupo") ?? 0}
              dragAtivo={dragAtivo}
              tamanho={tamanhoDashboard["despesas-grupo"]}
              onAlternarTamanho={handleAlternarTamanho}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className={obterClasseTamanhoCard(
                "detail",
                tamanhoDashboard["despesas-grupo"]
              )}
            >
              <CardBase titulo="Despesas por Grupo">
                <div className="space-y-4">
                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={despesasPorGrupoMensal}>
                        <CartesianGrid
                          stroke="rgba(148,163,184,0.08)"
                          strokeDasharray="3 6"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="mes"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: "var(--color-muted-foreground)",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: "var(--color-muted-foreground)",
                            fontSize: 12,
                          }}
                          tickFormatter={(valor) => `${valor / 1000} mil`}
                        />
                        <Tooltip
                          content={
                            <TooltipPadrao formatarValor={formatarValor} />
                          }
                        />
                        {categoriasStack.map((categoria, indice) => (
                          <Bar
                            key={categoria}
                            dataKey={categoria}
                            stackId="despesas"
                            fill={
                              paletaCategorias[indice % paletaCategorias.length]
                            }
                            radius={
                              indice === categoriasStack.length - 1
                                ? [4, 4, 0, 0]
                                : [0, 0, 0, 0]
                            }
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {categoriasStack.map((categoria, indice) => (
                      <button
                        key={categoria}
                        type="button"
                        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span
                          className="inline-block size-2.5 rounded-md"
                          style={{
                            backgroundColor:
                              paletaCategorias[indice % paletaCategorias.length],
                          }}
                        />
                        <span>{obterEmojiCategoria(categoria)}</span>
                        <span>{categoria}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardBase>
            </DashboardOrdenavelSlot>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
