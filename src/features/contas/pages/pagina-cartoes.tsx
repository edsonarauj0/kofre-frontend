import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { EChartsOption } from "echarts"
import * as echarts from "echarts/core"
import { BarChart, LineChart, PieChart } from "echarts/charts"
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components"
import ReactEChartsCore from "echarts-for-react/lib/core"
import { CanvasRenderer } from "echarts/renderers"
import {
  IconChartDonut3,
  IconChevronDown,
  IconCreditCard,
  IconLayoutGrid,
  IconPencil,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconSparkles,
  IconTarget,
  IconTrash,
  IconTrendingUp,
} from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { useAuth } from "@/app/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { atualizarContaApi, criarContaApi, excluirContaApi, listarContasApi } from "@/features/contas/api/contas-api"
import { listarCategoriasApi, listarTransacoesApi } from "@/features/transacoes/api/transacoes-api"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"
import { LogoBanco } from "@/shared/components/logo-banco"
import { bancosDisponiveis, obterBancoPorInstituicao } from "@/shared/lib/bancos"
import {
  formatarMoeda,
  obterSimboloMoeda,
  parseValorDigitado,
} from "@/shared/lib/formatadores"
import type { Conta, MeioPagamento, Transacao } from "@/shared/types/financeiro"

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const schemaCartao = z.object({
  nome: z.string().min(2, "Informe o nome do cartão"),
  instituicao: z.string().min(2, "Informe a bandeira ou banco"),
  limiteCredito: z
    .string()
    .min(1, "Informe o limite")
    .refine(
      (valor) => parseValorDigitado(valor) >= 0,
      "Limite não pode ser negativo"
    ),
  diaFechamento: z
    .string()
    .optional()
    .refine(
      (valor) => !valor || (Number(valor) >= 1 && Number(valor) <= 31),
      "Dia deve estar entre 1 e 31"
    ),
  diaVencimento: z
    .string()
    .optional()
    .refine(
      (valor) => !valor || (Number(valor) >= 1 && Number(valor) <= 31),
      "Dia deve estar entre 1 e 31"
    ),
})

type FormularioCartao = z.infer<typeof schemaCartao>
type SecaoCartoes = "faturas" | "consolidado" | "parcelas"
type FiltroMovimentacao = "todas" | "compras" | "parceladas" | "creditos"
type EscopoMovimentacao = "ciclo" | "historico"

function obterLimiteCartao(conta?: Conta | null) {
  return conta?.limiteCredito ?? conta?.saldoAtual ?? 0
}

interface ParcelaResumo {
  id: string
  descricao: string
  categoria: string
  valorParcela: number
  valorRestante: number
  valorTotal: number
  parcelaAtual: number
  parcelaTotal: number
  progresso: number
  primeiraCompra: string
  proximasParcelas: Array<{
    id: string
    data: string
    valor: number
    numero: number | null
  }>
}

interface SerieMensalCartao {
  chave: string
  mes: string
  descricao: string
  valor: number
}

const paletaCategorias = ["#7C3AED", "#0EA5E9", "#10B981", "#F59E0B", "#FB7185", "#14B8A6"]

function obterDataLocal(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

function normalizarData(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate()
  ).padStart(2, "0")}`
}

function adicionarMeses(data: Date, quantidade: number) {
  return new Date(data.getFullYear(), data.getMonth() + quantidade, 1)
}

function formatarMesCurto(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  })
    .format(data)
    .replace(".", "")
}

function formatarMesLongo(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(data)
}

function formatarDiaMes(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(obterDataLocal(dataIso))
}

function formatarDataLonga(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(obterDataLocal(dataIso))
}

function formatarMoedaCompacta(valor: number, moeda: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(valor)
}

function obterRotuloMeioPagamento(meioPagamento?: MeioPagamento | null) {
  switch (meioPagamento) {
    case "DEBITO":
      return "Débito"
    case "CREDITO":
      return "Crédito"
    case "PIX":
      return "Pix"
    case "BOLETO":
      return "Boleto"
    default:
      return "Não informado"
  }
}

function calcularFaturaCartao(dataLancamento: string, diaFechamento?: number | null) {
  const data = obterDataLocal(dataLancamento)

  if (!diaFechamento) {
    return {
      chave: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`,
      dataReferencia: new Date(data.getFullYear(), data.getMonth(), 1),
      descricao: formatarMesLongo(new Date(data.getFullYear(), data.getMonth(), 1)),
    }
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

  const dataReferencia = new Date(anoFatura, mesFatura - 1, 1)
  return {
    chave: `${anoFatura}-${String(mesFatura).padStart(2, "0")}`,
    dataReferencia,
    descricao: formatarMesLongo(dataReferencia),
  }
}

function obterMelhorDiaCompra(diaFechamento?: number | null) {
  if (!diaFechamento) return null
  return diaFechamento >= 31 ? 1 : diaFechamento + 1
}

function obterProximoVencimento(diaVencimento?: number | null, referencia = new Date()) {
  if (!diaVencimento) return null

  const data = new Date(referencia.getFullYear(), referencia.getMonth(), diaVencimento)
  if (data < referencia) {
    return new Date(referencia.getFullYear(), referencia.getMonth() + 1, diaVencimento)
  }

  return data
}

function corUtilizacao(percentual: number) {
  if (percentual >= 90) return "text-destructive"
  if (percentual >= 70) return "text-amber-500"
  return "text-emerald-600 dark:text-emerald-400"
}

function obterStatusLimite(percentual: number) {
  if (percentual >= 90) {
    return {
      rotulo: "Limite em atenção",
      descricao: "O uso atual do limite já está muito próximo do teto configurado.",
      variant: "destructive" as const,
    }
  }

  if (percentual >= 70) {
    return {
      rotulo: "Uso moderado",
      descricao: "Ainda há folga, mas vale monitorar o uso atual e as próximas compras.",
      variant: "warning" as const,
    }
  }

  return {
    rotulo: "Uso confortável",
    descricao: "O uso atual do limite ainda está sob controle.",
    variant: "success" as const,
  }
}

function normalizarHex(cor?: string | null, fallback = "#475569") {
  if (!cor) {
    return fallback
  }

  const valor = cor.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(valor)) {
    return valor
  }

  if (/^#[0-9a-fA-F]{3}$/.test(valor)) {
    return `#${valor[1]}${valor[1]}${valor[2]}${valor[2]}${valor[3]}${valor[3]}`
  }

  return fallback
}

function hexParaRgb(cor: string) {
  const normalizada = normalizarHex(cor)
  return {
    r: Number.parseInt(normalizada.slice(1, 3), 16),
    g: Number.parseInt(normalizada.slice(3, 5), 16),
    b: Number.parseInt(normalizada.slice(5, 7), 16),
  }
}

function rgba(cor: string, alpha: number) {
  const { r, g, b } = hexParaRgb(cor)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function misturarCores(corA: string, corB: string, pesoB: number) {
  const corNormalizadaA = normalizarHex(corA)
  const corNormalizadaB = normalizarHex(corB)
  const { r: rA, g: gA, b: bA } = hexParaRgb(corNormalizadaA)
  const { r: rB, g: gB, b: bB } = hexParaRgb(corNormalizadaB)
  const pesoA = 1 - pesoB

  const r = Math.round(rA * pesoA + rB * pesoB)
  const g = Math.round(gA * pesoA + gB * pesoB)
  const b = Math.round(bA * pesoA + bB * pesoB)

  return `#${[r, g, b]
    .map((valor) => valor.toString(16).padStart(2, "0"))
    .join("")}`
}

function themeCartao(instituicao?: string | null) {
  const banco = obterBancoPorInstituicao(instituicao)
  const corPrincipal = normalizarHex(banco?.foreground, "#4F46E5")
  const corBase = misturarCores(corPrincipal, "#08111F", 0.72)
  const corProfunda = misturarCores(corPrincipal, "#111827", 0.48)
  const corAura = misturarCores(corPrincipal, "#FFFFFF", 0.18)
  const corSecundaria = normalizarHex(banco?.background, "#E2E8F0")

  return {
    containerStyle: {
      borderColor: rgba(corAura, 0.3),
      backgroundImage: [
        `radial-gradient(circle at 14% 18%, ${rgba(corPrincipal, 0.34)} 0%, transparent 34%)`,
        `radial-gradient(circle at 88% 4%, ${rgba(corSecundaria, 0.22)} 0%, transparent 26%)`,
        `linear-gradient(145deg, ${corBase} 0%, ${corPrincipal} 54%, ${corProfunda} 100%)`,
      ].join(", "),
      boxShadow: `inset 0 1px 0 ${rgba("#FFFFFF", 0.12)}, 0 18px 40px ${rgba(
        corPrincipal,
        0.22
      )}`,
    } satisfies React.CSSProperties,
    glowTopStyle: {
      backgroundColor: rgba(corAura, 0.14),
    } satisfies React.CSSProperties,
    glowBottomStyle: {
      backgroundColor: rgba(corPrincipal, 0.16),
    } satisfies React.CSSProperties,
    shineStyle: {
      background: `linear-gradient(90deg, ${rgba("#FFFFFF", 0.08)} 0%, ${rgba(
        "#FFFFFF",
        0.22
      )} 50%, ${rgba("#FFFFFF", 0.08)} 100%)`,
      boxShadow: `inset 0 1px 0 ${rgba("#FFFFFF", 0.08)}`,
    } satisfies React.CSSProperties,
    badgeStyle: {
      backgroundColor: rgba("#FFFFFF", 0.12),
      color: rgba("#FFFFFF", 0.9),
      borderColor: rgba("#FFFFFF", 0.16),
    } satisfies React.CSSProperties,
    panelStyle: {
      borderColor: rgba("#FFFFFF", 0.16),
      backgroundColor: rgba("#FFFFFF", 0.1),
      boxShadow: `inset 0 1px 0 ${rgba("#FFFFFF", 0.08)}`,
    } satisfies React.CSSProperties,
    metricStyle: {
      borderColor: rgba("#FFFFFF", 0.12),
      backgroundColor: rgba("#FFFFFF", 0.08),
    } satisfies React.CSSProperties,
    activeStyle: {
      borderColor: rgba(corPrincipal, 0.42),
      backgroundColor: rgba(corSecundaria, 0.08),
      boxShadow: `0 18px 38px ${rgba(corPrincipal, 0.18)}`,
    } satisfies React.CSSProperties,
  }
}

function buildGradient(cor: string, opacidadeInicial = 0.32, opacidadeFinal = 0.04) {
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `${cor}${Math.round(opacidadeInicial * 255).toString(16).padStart(2, "0")}` },
      { offset: 1, color: `${cor}${Math.round(opacidadeFinal * 255).toString(16).padStart(2, "0")}` },
    ],
  }
}

function AgrupamentoMetricas({
  titulo,
  valor,
  descricao,
  destaque = "default",
}: {
  titulo: string
  valor: string
  descricao: string
  destaque?: "default" | "success" | "warning"
}) {
  const corValor =
    destaque === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : destaque === "warning"
      ? "text-amber-500"
      : "text-foreground"

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className={cn("text-2xl", corValor)}>{valor}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{descricao}</CardContent>
    </Card>
  )
}

function LinhaTransacaoExpansivel({
  transacao,
  cartao,
}: {
  transacao: Transacao
  cartao: Conta
}) {
  const [aberta, setAberta] = React.useState(false)
  const referenciaFatura = calcularFaturaCartao(transacao.data, cartao.diaFechamento)
  const parcelaRotulo =
    transacao.parcelada && transacao.parcelaNumero && transacao.parcelaTotal
      ? `${transacao.parcelaNumero}/${transacao.parcelaTotal}`
      : "À vista"

  return (
    <Collapsible open={aberta} onOpenChange={setAberta}>
      <div className="rounded-md  border border-border/70 bg-card/70 transition hover:border-primary/30">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">{transacao.descricao}</p>
                {transacao.parcelada ? <Badge variant="secondary">{parcelaRotulo}</Badge> : null}
                {transacao.tipo !== "despesa" ? <Badge variant="outline">Crédito</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {transacao.categoria} • {formatarDiaMes(transacao.data)} • Fatura {referenciaFatura.descricao}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold">{formatarMoeda(transacao.valor)}</p>
                <p className="text-xs text-muted-foreground">
                  {aberta ? "Ocultar detalhes" : "Ver detalhes"}
                </p>
              </div>
              <IconChevronDown
                className={cn("mt-1 size-4 text-muted-foreground transition-transform", aberta && "rotate-180")}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border/70 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md  bg-muted/40 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Data</p>
              <p className="mt-1 text-sm font-medium">{formatarDataLonga(transacao.data)}</p>
            </div>
            <div className="rounded-md  bg-muted/40 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Categoria</p>
              <p className="mt-1 text-sm font-medium">{transacao.categoria}</p>
            </div>
            <div className="rounded-md  bg-muted/40 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Meio de pagamento</p>
              <p className="mt-1 text-sm font-medium">{obterRotuloMeioPagamento(transacao.meioPagamento)}</p>
            </div>
            <div className="rounded-md  bg-muted/40 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Ciclo</p>
              <p className="mt-1 text-sm font-medium capitalize">{referenciaFatura.descricao}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md  border border-border/70 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Grupo</p>
              <p className="mt-1 text-sm font-medium">{transacao.categoriaGrupo ?? "Sem grupo"}</p>
            </div>
            <div className="rounded-md  border border-border/70 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Valor original</p>
              <p className="mt-1 text-sm font-medium">
                {formatarMoeda(transacao.valorOriginal ?? transacao.valor)}
              </p>
            </div>
            <div className="rounded-md  border border-border/70 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Parcelamento</p>
              <p className="mt-1 text-sm font-medium">{parcelaRotulo}</p>
            </div>
            <div className="rounded-md  border border-border/70 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Cartão</p>
              <p className="mt-1 text-sm font-medium">{cartao.nome}</p>
            </div>
          </div>

          {transacao.observacao ? (
            <div className="mt-4 rounded-md  border border-dashed border-border/70 bg-muted/20 px-3 py-3">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Observação</p>
              <p className="mt-1 text-sm text-foreground">{transacao.observacao}</p>
            </div>
          ) : null}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function LinhaParcelaExpansivel({ parcela }: { parcela: ParcelaResumo }) {
  const [aberta, setAberta] = React.useState(false)

  return (
    <Collapsible open={aberta} onOpenChange={setAberta}>
      <div className="rounded-md  border border-border/70 bg-card/70 transition hover:border-primary/30">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold">{parcela.descricao}</p>
                <Badge variant="secondary">{parcela.categoria}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {parcela.parcelaAtual}/{parcela.parcelaTotal} parcelas em andamento • saldo futuro de{" "}
                {formatarMoeda(parcela.valorRestante)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold">{formatarMoeda(parcela.valorParcela)}</p>
                <p className="text-xs text-muted-foreground">Parcela atual</p>
              </div>
              <IconChevronDown
                className={cn("mt-1 size-4 text-muted-foreground transition-transform", aberta && "rotate-180")}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border/70 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md  bg-muted/40 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Valor total</p>
              <p className="mt-1 text-sm font-semibold">{formatarMoeda(parcela.valorTotal)}</p>
            </div>
            <div className="rounded-md  bg-muted/40 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Primeira compra</p>
              <p className="mt-1 text-sm font-semibold">{formatarDiaMes(parcela.primeiraCompra)}</p>
            </div>
            <div className="rounded-md  bg-muted/40 px-3 py-2">
              <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">Restante</p>
              <p className="mt-1 text-sm font-semibold text-amber-500">{formatarMoeda(parcela.valorRestante)}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span>
                {parcela.parcelaAtual}/{parcela.parcelaTotal}
              </span>
            </div>
            <Progress value={parcela.progresso} />
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {parcela.proximasParcelas.map((item) => (
              <div key={item.id} className="rounded-md  border border-border/70 px-3 py-3">
                <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">
                  {item.numero ? `${item.numero}ª parcela` : "Próxima parcela"}
                </p>
                <p className="mt-1 text-sm font-medium">{formatarDiaMes(item.data)}</p>
                <p className="text-xs text-muted-foreground">{formatarMoeda(item.valor)}</p>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function PaginaCartoes() {
  const { moeda } = useAuth()
  const queryClient = useQueryClient()
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = React.useState("")
  const [sheetAberta, setSheetAberta] = React.useState(false)
  const [cartaoEmEdicao, setCartaoEmEdicao] = React.useState<Conta | null>(null)
  const [mensagemSucesso, setMensagemSucesso] = React.useState("")
  const [mensagemErro, setMensagemErro] = React.useState("")
  const [secaoAtiva, setSecaoAtiva] = React.useState<SecaoCartoes>("consolidado")
  const [filtroMovimentacao, setFiltroMovimentacao] = React.useState<FiltroMovimentacao>("todas")
  const [escopoMovimentacao, setEscopoMovimentacao] = React.useState<EscopoMovimentacao>("ciclo")
  const [faturaSelecionadaChave, setFaturaSelecionadaChave] = React.useState("")
  const [buscaMovimentacao, setBuscaMovimentacao] = React.useState("")

  const buscaMovimentacaoAdiada = React.useDeferredValue(buscaMovimentacao)

  const contasQuery = useQuery({
    queryKey: ["contas"],
    queryFn: listarContasApi,
  })
  const categoriasQuery = useQuery({
    queryKey: ["categorias"],
    queryFn: listarCategoriasApi,
  })
  const transacoesQuery = useQuery({
    queryKey: ["transacoes", contasQuery.data, categoriasQuery.data],
    queryFn: () => listarTransacoesApi(categoriasQuery.data ?? [], contasQuery.data ?? []),
    enabled: Boolean(contasQuery.data && categoriasQuery.data),
  })

  const contas = contasQuery.data ?? []
  const cartoes = contas.filter((conta) => conta.tipo === "cartao_credito")
  const transacoes = transacoesQuery.data ?? []

  React.useEffect(() => {
    if (cartoes.length === 0) {
      setCartaoSelecionadoId("")
      return
    }

    if (!cartoes.some((cartao) => cartao.id === cartaoSelecionadoId)) {
      setCartaoSelecionadoId(cartoes[0].id)
    }
  }, [cartoes, cartaoSelecionadoId])

  const cartaoSelecionado = cartoes.find((cartao) => cartao.id === cartaoSelecionadoId) ?? null

  const transacoesCartao = React.useMemo(() => {
    if (!cartaoSelecionado) return []

    return transacoes
      .filter((transacao) => transacao.contaId === cartaoSelecionado.id)
      .sort((a, b) => obterDataLocal(b.data).getTime() - obterDataLocal(a.data).getTime())
  }, [cartaoSelecionado, transacoes])

  const despesasCartao = React.useMemo(
    () => transacoesCartao.filter((transacao) => transacao.tipo === "despesa"),
    [transacoesCartao]
  )

  const hoje = React.useMemo(() => new Date(), [])
  const referenciaFaturaAtual = cartaoSelecionado
    ? calcularFaturaCartao(normalizarData(hoje), cartaoSelecionado.diaFechamento)
    : null

  const faturasPorMes = React.useMemo(() => {
    if (!cartaoSelecionado) return []

    const mapa = new Map<
      string,
      {
        chave: string
        dataReferencia: Date
        descricao: string
        total: number
      }
    >()

    despesasCartao.forEach((transacao) => {
      const referencia = calcularFaturaCartao(transacao.data, cartaoSelecionado.diaFechamento)
      const atual = mapa.get(referencia.chave)

      if (atual) {
        atual.total += transacao.valor
        return
      }

      mapa.set(referencia.chave, {
        chave: referencia.chave,
        dataReferencia: referencia.dataReferencia,
        descricao: referencia.descricao,
        total: transacao.valor,
      })
    })

    return Array.from(mapa.values()).sort(
      (a, b) => b.dataReferencia.getTime() - a.dataReferencia.getTime()
    )
  }, [cartaoSelecionado, despesasCartao])

  const referenciasFaturaDisponiveis = React.useMemo(() => {
    const mapa = new Map<
      string,
      {
        chave: string
        dataReferencia: Date
        descricao: string
      }
    >()

    faturasPorMes.forEach((fatura) => {
      mapa.set(fatura.chave, {
        chave: fatura.chave,
        dataReferencia: fatura.dataReferencia,
        descricao: fatura.descricao,
      })
    })

    if (referenciaFaturaAtual) {
      mapa.set(referenciaFaturaAtual.chave, referenciaFaturaAtual)
    }

    return Array.from(mapa.values()).sort((a, b) => b.dataReferencia.getTime() - a.dataReferencia.getTime())
  }, [faturasPorMes, referenciaFaturaAtual])

  React.useEffect(() => {
    if (referenciasFaturaDisponiveis.length === 0) {
      if (faturaSelecionadaChave) {
        setFaturaSelecionadaChave("")
      }
      return
    }

    if (
      faturaSelecionadaChave &&
      referenciasFaturaDisponiveis.some((referencia) => referencia.chave === faturaSelecionadaChave)
    ) {
      return
    }

    setFaturaSelecionadaChave(
      referenciaFaturaAtual?.chave ?? referenciasFaturaDisponiveis[0]?.chave ?? ""
    )
  }, [faturaSelecionadaChave, referenciaFaturaAtual?.chave, referenciasFaturaDisponiveis])

  const referenciaFaturaSelecionada = React.useMemo(
    () =>
      referenciasFaturaDisponiveis.find((referencia) => referencia.chave === faturaSelecionadaChave) ??
      referenciaFaturaAtual ??
      referenciasFaturaDisponiveis[0] ??
      null,
    [faturaSelecionadaChave, referenciaFaturaAtual, referenciasFaturaDisponiveis]
  )

  const referenciaProximaFaturaSelecionada = React.useMemo(() => {
    if (!cartaoSelecionado || !referenciaFaturaSelecionada) return null
    const proximaData = adicionarMeses(referenciaFaturaSelecionada.dataReferencia, 1)
    return {
      chave: `${proximaData.getFullYear()}-${String(proximaData.getMonth() + 1).padStart(2, "0")}`,
      dataReferencia: proximaData,
      descricao: formatarMesLongo(proximaData),
    }
  }, [cartaoSelecionado, referenciaFaturaSelecionada])

  const referenciaComprometimentoAtual = referenciaFaturaAtual ?? referenciaFaturaSelecionada

  const faturasNavegaveis = React.useMemo(() => {
    const totaisPorChave = new Map(faturasPorMes.map((fatura) => [fatura.chave, fatura.total]))

    return referenciasFaturaDisponiveis.map((referencia) => ({
      ...referencia,
      total: totaisPorChave.get(referencia.chave) ?? 0,
      atual: referencia.chave === referenciaFaturaAtual?.chave,
    }))
  }, [faturasPorMes, referenciaFaturaAtual?.chave, referenciasFaturaDisponiveis])

  const faturaSelecionadaTotal = React.useMemo(() => {
    if (!referenciaFaturaSelecionada) return 0

    return despesasCartao
      .filter(
        (transacao) =>
          calcularFaturaCartao(transacao.data, cartaoSelecionado?.diaFechamento).chave ===
          referenciaFaturaSelecionada.chave
      )
      .reduce((total, transacao) => total + transacao.valor, 0)
  }, [cartaoSelecionado?.diaFechamento, despesasCartao, referenciaFaturaSelecionada])

  const proximaFatura = React.useMemo(() => {
    if (!referenciaProximaFaturaSelecionada) return 0

    return despesasCartao
      .filter(
        (transacao) =>
          calcularFaturaCartao(transacao.data, cartaoSelecionado?.diaFechamento).chave ===
          referenciaProximaFaturaSelecionada.chave
      )
      .reduce((total, transacao) => total + transacao.valor, 0)
  }, [cartaoSelecionado?.diaFechamento, despesasCartao, referenciaProximaFaturaSelecionada])

  const transacoesFaturaSelecionada = React.useMemo(() => {
    if (!referenciaFaturaSelecionada) return []

    return despesasCartao.filter(
      (transacao) =>
        calcularFaturaCartao(transacao.data, cartaoSelecionado?.diaFechamento).chave ===
        referenciaFaturaSelecionada.chave
    )
  }, [cartaoSelecionado?.diaFechamento, despesasCartao, referenciaFaturaSelecionada])

  const parcelamentosAtivos = React.useMemo<ParcelaResumo[]>(() => {
    if (!cartaoSelecionado || !referenciaFaturaSelecionada) return []

    const grupos = new Map<string, Transacao[]>()

    despesasCartao
      .filter(
        (transacao) =>
          transacao.parcelada &&
          transacao.parcelaTotal &&
          transacao.parcelaTotal > 1 &&
          transacao.parcelaNumero
      )
      .forEach((transacao) => {
        const chave =
          transacao.grupoParcelamentoId ??
          `${transacao.descricao}-${transacao.contaId}-${transacao.parcelaTotal}`

        grupos.set(chave, [...(grupos.get(chave) ?? []), transacao])
      })

    return Array.from(grupos.entries())
      .map(([chave, itens]) => {
        const ordenadas = [...itens].sort((a, b) => {
          const diferencaData = obterDataLocal(a.data).getTime() - obterDataLocal(b.data).getTime()
          if (diferencaData !== 0) return diferencaData
          return (a.parcelaNumero ?? 0) - (b.parcelaNumero ?? 0)
        })

        const futuras = ordenadas.filter((item) => {
          const referencia = calcularFaturaCartao(item.data, cartaoSelecionado.diaFechamento)
          return referencia.dataReferencia.getTime() >= referenciaFaturaSelecionada.dataReferencia.getTime()
        })

        if (futuras.length === 0) return null

        const parcelaAtual = futuras[0]
        const totalParcelas = Math.max(...ordenadas.map((item) => item.parcelaTotal ?? 1))
        const numeroAtual = parcelaAtual.parcelaNumero ?? 1
        const valorRestante = futuras.reduce((total, item) => total + item.valor, 0)
        const valorTotal = ordenadas.reduce((total, item) => total + item.valor, 0)

        return {
          id: chave,
          descricao: parcelaAtual.descricao,
          categoria: parcelaAtual.categoria,
          valorParcela: parcelaAtual.valor,
          valorRestante,
          valorTotal,
          parcelaAtual: numeroAtual,
          parcelaTotal: totalParcelas,
          progresso: (numeroAtual / totalParcelas) * 100,
          primeiraCompra: ordenadas[0]?.data ?? parcelaAtual.data,
          proximasParcelas: futuras.slice(0, 3).map((item) => ({
            id: item.id,
            data: item.data,
            valor: item.valor,
            numero: item.parcelaNumero ?? null,
          })),
        }
      })
      .filter((item): item is ParcelaResumo => Boolean(item))
      .sort((a, b) => b.valorRestante - a.valorRestante)
  }, [cartaoSelecionado, despesasCartao, referenciaFaturaSelecionada])

  const serieParcelas = React.useMemo<SerieMensalCartao[]>(() => {
    if (!cartaoSelecionado || !referenciaFaturaSelecionada) return []

    return Array.from({ length: 8 }, (_, indice) => {
      const dataReferencia = adicionarMeses(referenciaFaturaSelecionada.dataReferencia, indice)
      const chave = `${dataReferencia.getFullYear()}-${String(dataReferencia.getMonth() + 1).padStart(
        2,
        "0"
      )}`

      const total = despesasCartao
        .filter((transacao) => transacao.parcelada)
        .filter(
          (transacao) =>
            calcularFaturaCartao(transacao.data, cartaoSelecionado.diaFechamento).chave === chave
        )
        .reduce((soma, transacao) => soma + transacao.valor, 0)

      return {
        chave,
        mes: formatarMesCurto(dataReferencia),
        descricao: formatarMesLongo(dataReferencia),
        valor: total,
      }
    })
  }, [cartaoSelecionado, despesasCartao, referenciaFaturaSelecionada])

  const pagamentosECreditos = React.useMemo(() => {
    if (!referenciaFaturaSelecionada) return []

    return transacoesCartao
      .filter((transacao) => transacao.tipo !== "despesa")
      .filter(
        (transacao) =>
          calcularFaturaCartao(transacao.data, cartaoSelecionado?.diaFechamento).chave ===
          referenciaFaturaSelecionada.chave
      )
      .slice(0, 6)
  }, [cartaoSelecionado?.diaFechamento, referenciaFaturaSelecionada, transacoesCartao])

  const historicoFaturas = React.useMemo<SerieMensalCartao[]>(() => {
    if (!referenciaFaturaSelecionada) return []

    const totaisPorChave = new Map(faturasPorMes.map((fatura) => [fatura.chave, fatura.total]))

    return Array.from({ length: 13 }, (_, indice) => {
      const dataReferencia = adicionarMeses(referenciaFaturaSelecionada.dataReferencia, indice)
      const chave = `${dataReferencia.getFullYear()}-${String(dataReferencia.getMonth() + 1).padStart(
        2,
        "0"
      )}`

      return {
        chave,
        mes: formatarMesCurto(dataReferencia),
        descricao: formatarMesLongo(dataReferencia),
        valor: totaisPorChave.get(chave) ?? 0,
      }
    })
  }, [faturasPorMes, referenciaFaturaSelecionada])

  const distribuicaoCategorias = React.useMemo(() => {
    const mapa = new Map<string, number>()

    transacoesFaturaSelecionada.forEach((transacao) => {
      mapa.set(transacao.categoria, (mapa.get(transacao.categoria) ?? 0) + transacao.valor)
    })

    return Array.from(mapa.entries())
      .map(([nome, valor], indice) => ({
        nome,
        valor,
        cor: paletaCategorias[indice % paletaCategorias.length],
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6)
  }, [transacoesFaturaSelecionada])

  const topEstabelecimentos = React.useMemo(() => {
    const mapa = new Map<string, number>()

    transacoesFaturaSelecionada.forEach((transacao) => {
      mapa.set(transacao.descricao, (mapa.get(transacao.descricao) ?? 0) + transacao.valor)
    })

    return Array.from(mapa.entries())
      .map(([nome, valor], indice) => ({
        nome,
        valor,
        cor: paletaCategorias[indice % paletaCategorias.length],
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
  }, [transacoesFaturaSelecionada])

  const totalComprometido = React.useMemo(() => {
    if (!cartaoSelecionado || !referenciaComprometimentoAtual) return 0

    const totalEmUso = transacoesCartao
      .filter((transacao) => transacao.tipo !== "transferencia")
      .filter((transacao) => {
        const referencia = calcularFaturaCartao(transacao.data, cartaoSelecionado.diaFechamento)
        return (
          referencia.dataReferencia.getTime() >=
          referenciaComprometimentoAtual.dataReferencia.getTime()
        )
      })
      .reduce((total, transacao) => {
        const impacto = transacao.tipo === "despesa" ? transacao.valor : -transacao.valor
        return total + impacto
      }, 0)

    return Math.max(totalEmUso, 0)
  }, [cartaoSelecionado, referenciaComprometimentoAtual, transacoesCartao])
  const limiteTotalCartaoSelecionado = obterLimiteCartao(cartaoSelecionado)
  const limiteDisponivel = cartaoSelecionado
    ? Math.max(limiteTotalCartaoSelecionado - totalComprometido, 0)
    : 0
  const percentualUtilizado =
    cartaoSelecionado && limiteTotalCartaoSelecionado > 0
      ? (totalComprometido / limiteTotalCartaoSelecionado) * 100
      : 0
  const melhorDiaCompra = obterMelhorDiaCompra(cartaoSelecionado?.diaFechamento)
  const proximoVencimento = obterProximoVencimento(cartaoSelecionado?.diaVencimento, hoje)
  const ticketMedioAtual =
    transacoesFaturaSelecionada.length > 0
      ? faturaSelecionadaTotal / transacoesFaturaSelecionada.length
      : 0
  const statusLimite = obterStatusLimite(percentualUtilizado)
  const categoriaPrincipal = distribuicaoCategorias[0]
  const principalLoja = topEstabelecimentos[0]

  const baseMovimentacoes =
    escopoMovimentacao === "ciclo" ? transacoesFaturaSelecionada : transacoesCartao

  const movimentacoesFiltradas = React.useMemo(() => {
    const busca = buscaMovimentacaoAdiada.trim().toLowerCase()

    return baseMovimentacoes.filter((transacao) => {
      if (filtroMovimentacao === "compras" && transacao.tipo !== "despesa") return false
      if (filtroMovimentacao === "creditos" && transacao.tipo === "despesa") return false
      if (filtroMovimentacao === "parceladas" && !transacao.parcelada) return false

      if (!busca) return true

      const termos = [
        transacao.descricao,
        transacao.categoria,
        transacao.categoriaGrupo,
        transacao.observacao,
        formatarDataLonga(transacao.data),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return termos.includes(busca)
    })
  }, [baseMovimentacoes, buscaMovimentacaoAdiada, filtroMovimentacao])

  const historicoFaturasOption = React.useMemo(
    () =>
      ({
      color: ["#7C3AED", "#A78BFA"],
      tooltip: {
        trigger: "axis",
        backgroundColor: "#FFFFFF",
        borderColor: "rgba(148, 163, 184, 0.22)",
        borderRadius: 18,
        textStyle: { color: "#0F172A" },
        valueFormatter: (valor: unknown) => formatarMoeda(Number(valor ?? 0)),
      },
      grid: { top: 24, right: 18, bottom: 12, left: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: historicoFaturas.map((item) => item.mes),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#64748B" },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.14)" } },
        axisLabel: {
          color: "#64748B",
          formatter: (valor: number) => formatarMoedaCompacta(valor, moeda),
        },
      },
      series: [
        {
          name: "Fatura",
          type: "bar",
          data: historicoFaturas.map((item) => item.valor),
          barWidth: 18,
          itemStyle: {
            color: "rgba(124, 58, 237, 0.12)",
            borderRadius: [10, 10, 0, 0],
          },
        },
        {
          name: "Fatura",
          type: "line",
          smooth: true,
          data: historicoFaturas.map((item) => item.valor),
          symbol: "circle",
          symbolSize: 9,
          lineStyle: { width: 3, color: "#7C3AED" },
          itemStyle: { color: "#7C3AED", borderColor: "#FFFFFF", borderWidth: 2 },
          areaStyle: {
            color: buildGradient("#7C3AED", 0.28, 0.02),
          },
        },
      ],
      }) as EChartsOption,
    [historicoFaturas, moeda]
  )

  const categoriasOption = React.useMemo(
    () =>
      ({
      color: distribuicaoCategorias.map((item) => item.cor),
      tooltip: {
        trigger: "item",
        backgroundColor: "#FFFFFF",
        borderColor: "rgba(148, 163, 184, 0.22)",
        borderRadius: 16,
        formatter: (params: any) =>
          `${params.name}<br/>${formatarMoeda(Number(params.value ?? 0))} • ${params.percent}%`,
      },
      legend: {
        bottom: 0,
        icon: "circle",
        itemWidth: 10,
        textStyle: { color: "#475569", fontSize: 11 },
      },
      series: [
        {
          type: "pie",
          radius: ["54%", "76%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: {
            scale: true,
          },
          data: distribuicaoCategorias.map((item) => ({
            name: item.nome,
            value: item.valor,
          })),
        },
      ],
      }) as EChartsOption,
    [distribuicaoCategorias]
  )

  const estabelecimentosOption = React.useMemo(
    () =>
      ({
      color: ["#0EA5E9"],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#FFFFFF",
        borderColor: "rgba(148, 163, 184, 0.22)",
        borderRadius: 16,
        valueFormatter: (valor: unknown) => formatarMoeda(Number(valor ?? 0)),
      },
      grid: { top: 8, right: 18, bottom: 8, left: 8, containLabel: true },
      xAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.14)" } },
        axisLabel: {
          color: "#64748B",
          formatter: (valor: number) => formatarMoedaCompacta(valor, moeda),
        },
      },
      yAxis: {
        type: "category",
        data: topEstabelecimentos.map((item) => item.nome),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#334155",
          width: 180,
          overflow: "truncate",
        },
      },
      series: [
        {
          type: "bar",
          data: topEstabelecimentos.map((item) => item.valor),
          barWidth: 14,
          itemStyle: {
            color: "#0EA5E9",
            borderRadius: [0, 10, 10, 0],
          },
        },
      ],
      }) as EChartsOption,
    [moeda, topEstabelecimentos]
  )

  const parcelasOption = React.useMemo(
    () =>
      ({
      color: ["#F59E0B", "#7C3AED"],
      tooltip: {
        trigger: "axis",
        backgroundColor: "#FFFFFF",
        borderColor: "rgba(148, 163, 184, 0.22)",
        borderRadius: 16,
        valueFormatter: (valor: unknown) => formatarMoeda(Number(valor ?? 0)),
      },
      grid: { top: 24, right: 18, bottom: 12, left: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: serieParcelas.map((item) => item.mes),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#64748B" },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.14)" } },
        axisLabel: {
          color: "#64748B",
          formatter: (valor: number) => formatarMoedaCompacta(valor, moeda),
        },
      },
      series: [
        {
          name: "Parcelas",
          type: "line",
          smooth: true,
          data: serieParcelas.map((item) => item.valor),
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 3, color: "#7C3AED" },
          itemStyle: { color: "#7C3AED", borderColor: "#FFFFFF", borderWidth: 2 },
          areaStyle: {
            color: buildGradient("#7C3AED", 0.24, 0.02),
          },
        },
        {
          name: "Saldo futuro",
          type: "bar",
          data: serieParcelas.map((item) => item.valor),
          barWidth: 16,
          itemStyle: {
            color: "rgba(245, 158, 11, 0.16)",
            borderRadius: [10, 10, 0, 0],
          },
        },
      ],
      }) as EChartsOption,
    [moeda, serieParcelas]
  )

  const criarCartaoMutation = useMutation({
    mutationFn: criarContaApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      resetCartao({
        nome: "",
        instituicao: bancosDisponiveis[0]?.nome ?? "",
        limiteCredito: "0",
        diaFechamento: "",
        diaVencimento: "",
      })
      setMensagemErro("")
      setMensagemSucesso("Cartão salvo com sucesso.")
      setTimeout(() => fecharSheet(), 800)
    },
    onError: () => {
      setMensagemSucesso("")
      setMensagemErro("Não foi possível salvar o cartão.")
    },
  })

  const editarCartaoMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: {
        nome: string
        instituicao: string
        saldoAtual: number
        limiteCredito?: number | null
        diaFechamento?: number | null
        diaVencimento?: number | null
      }
    }) => atualizarContaApi(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      setMensagemErro("")
      setMensagemSucesso("Cartão salvo com sucesso.")
      setTimeout(() => fecharSheet(), 800)
    },
    onError: () => {
      setMensagemSucesso("")
      setMensagemErro("Não foi possível atualizar o cartão.")
    },
  })

  const excluirCartaoMutation = useMutation({
    mutationFn: excluirContaApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      await queryClient.invalidateQueries({ queryKey: ["transacoes"] })
    },
  })

  const {
    control: controlCartao,
    register: registerCartao,
    handleSubmit: handleSubmitCartao,
    reset: resetCartao,
    setValue: setValueCartao,
    formState: { errors: errorsCartao, isSubmitting: isSubmittingCartao },
  } = useForm<FormularioCartao>({
    resolver: zodResolver(schemaCartao),
    defaultValues: {
      nome: "",
      instituicao: bancosDisponiveis[0]?.nome ?? "",
      limiteCredito: "0",
      diaFechamento: "",
      diaVencimento: "",
    },
  })

  function abrirNovoCartao() {
    setCartaoEmEdicao(null)
    resetCartao({
      nome: "",
      instituicao: bancosDisponiveis[0]?.nome ?? "",
      limiteCredito: "0",
      diaFechamento: "",
      diaVencimento: "",
    })
    setMensagemSucesso("")
    setMensagemErro("")
    setSheetAberta(true)
  }

  function abrirEdicao(cartao: Conta) {
    setCartaoEmEdicao(cartao)
    setValueCartao("nome", cartao.nome)
    setValueCartao("instituicao", cartao.instituicao)
    setValueCartao("limiteCredito", String(obterLimiteCartao(cartao)))
    setValueCartao("diaFechamento", cartao.diaFechamento ? String(cartao.diaFechamento) : "")
    setValueCartao("diaVencimento", cartao.diaVencimento ? String(cartao.diaVencimento) : "")
    setMensagemSucesso("")
    setMensagemErro("")
    setSheetAberta(true)
  }

  function fecharSheet() {
    setSheetAberta(false)
    setCartaoEmEdicao(null)
    resetCartao({
      nome: "",
      instituicao: bancosDisponiveis[0]?.nome ?? "",
      limiteCredito: "0",
      diaFechamento: "",
      diaVencimento: "",
    })
    setMensagemSucesso("")
    setMensagemErro("")
  }

  function confirmarExclusao(cartao: Conta) {
    if (
      window.confirm(
        `Excluir "${cartao.nome}"? Todas as transações vinculadas perderão a referência a este cartão.`
      )
    ) {
      excluirCartaoMutation.mutate(cartao.id)
    }
  }

  async function onSubmitCartao(valores: FormularioCartao) {
    setMensagemErro("")
    setMensagemSucesso("")

    const payload = {
      nome: valores.nome,
      instituicao: valores.instituicao,
      saldoAtual: cartaoEmEdicao?.saldoAtual ?? 0,
      limiteCredito: parseValorDigitado(valores.limiteCredito),
      diaFechamento: valores.diaFechamento ? Number(valores.diaFechamento) : null,
      diaVencimento: valores.diaVencimento ? Number(valores.diaVencimento) : null,
    }

    if (cartaoEmEdicao) {
      await editarCartaoMutation.mutateAsync({
        id: cartaoEmEdicao.id,
        payload,
      })
      return
    }

    await criarCartaoMutation.mutateAsync({
      tipo: "CARTAO_CREDITO",
      ...payload,
    })
  }

  const temaSelecionado = themeCartao(cartaoSelecionado?.instituicao)

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <CabecalhoPagina
        titulo="Cartões de Crédito"
        descricao="Uma experiência mais rica para acompanhar ciclo, histórico e parcelamentos do cartão."
        acoes={
          <Button size="lg" onClick={abrirNovoCartao}>
            <IconPlus />
            Novo cartão
          </Button>
        }
      />

      {contasQuery.isLoading || transacoesQuery.isLoading ? (
        <Card className="border-border/70">
          <CardContent className="py-10 text-sm text-muted-foreground">
            Carregando visão de cartões...
          </CardContent>
        </Card>
      ) : contasQuery.isError || transacoesQuery.isError ? (
        <Card className="border-border/70">
          <CardContent className="py-10 text-sm text-destructive">
            Não foi possível carregar os dados de cartões agora.
          </CardContent>
        </Card>
      ) : cartoes.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-md  bg-primary/8 p-4 text-primary">
              <IconCreditCard className="size-8" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Nenhum cartão cadastrado</p>
              <p className="text-sm text-muted-foreground">
                Crie o primeiro cartão para liberar a visão de fatura, parcelas e próximos ciclos.
              </p>
            </div>
            <Button onClick={abrirNovoCartao}>
              <IconPlus />
              Criar primeiro cartão
            </Button>
          </CardContent>
        </Card>
      ) : cartaoSelecionado ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.38fr)_minmax(340px,1fr)]">
            <Card className="min-w-0 border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconLayoutGrid className="size-5 text-primary" />
                  Carteira de cartões
                </CardTitle>
                <CardDescription>
                  Escolha o cartão que deseja analisar e navegue pela visão mais adequada para o momento.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {cartoes.map((cartao, indice) => {
                  const referenciaAtual = calcularFaturaCartao(normalizarData(hoje), cartao.diaFechamento)
                  const valorFatura = transacoes
                    .filter((transacao) => transacao.contaId === cartao.id && transacao.tipo === "despesa")
                    .filter(
                      (transacao) =>
                        calcularFaturaCartao(transacao.data, cartao.diaFechamento).chave ===
                        referenciaAtual.chave
                  )
                  .reduce((total, transacao) => total + transacao.valor, 0)
                  const ativo = cartao.id === cartaoSelecionado.id
                  const tema = themeCartao(cartao.instituicao)

                  return (
                    <button
                      key={cartao.id}
                      type="button"
                      onClick={() => setCartaoSelecionadoId(cartao.id)}
                      aria-pressed={ativo}
                      className={cn(
                        "rounded-md border text-left transition duration-200 hover:-translate-y-0.5",
                        ativo
                          ? "bg-card/70"
                          : "border-border/70 bg-card hover:border-primary/35"
                      )}
                      style={ativo ? tema.activeStyle : undefined}
                    >
                      <div
                        className="relative overflow-hidden rounded-[22px] border p-4 text-white shadow-sm"
                        style={tema.containerStyle}
                      >
                        <div
                          className="pointer-events-none absolute -left-5 -top-10 size-24 rounded-full blur-3xl"
                          style={tema.glowTopStyle}
                        />
                        <div
                          className="pointer-events-none absolute -bottom-8 right-6 h-20 w-20 rounded-full blur-2xl"
                          style={tema.glowBottomStyle}
                        />
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs tracking-[0.22em] text-white/70">Cartão</p>
                            <p className="mt-2 text-lg font-semibold">{cartao.nome}</p>
                            <p className="text-sm text-white/75">{cartao.instituicao}</p>
                          </div>
                          <LogoBanco
                            instituicao={cartao.instituicao}
                            tamanho="sm"
                            className="border-white/15 bg-white/10 shadow-sm"
                          />
                        </div>
                        <div className="mt-8 h-10 rounded-lg" style={tema.shineStyle} />
                        <div className="mt-5 flex items-center justify-between">
                          <Badge variant="outline" style={tema.badgeStyle}>
                            Fatura aberta {formatarMoeda(valorFatura)}
                          </Badge>
                          <span className="text-[11px] uppercase tracking-[0.24em] text-white/65">
                            {indice + 1 < 10 ? `0${indice + 1}` : indice + 1}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-3xl border p-6 text-white shadow-sm"
                )}
                style={temaSelecionado.containerStyle}
              >
                <div
                  className="pointer-events-none absolute -left-8 -top-14 size-32 rounded-full blur-3xl"
                  style={temaSelecionado.glowTopStyle}
                />
                <div
                  className="pointer-events-none absolute bottom-0 right-4 h-28 w-28 rounded-full blur-3xl"
                  style={temaSelecionado.glowBottomStyle}
                />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs tracking-[0.3em] text-white/70">Cartão selecionado</p>
                    <h3 className="mt-3 text-2xl font-semibold">{cartaoSelecionado.nome}</h3>
                    <p className="text-sm text-white/75">{cartaoSelecionado.instituicao}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="bg-white/14 text-white hover:bg-white/18"
                      onClick={() => abrirEdicao(cartaoSelecionado)}
                    >
                      <IconPencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="bg-white/14 text-white hover:bg-white/18"
                      onClick={() => confirmarExclusao(cartaoSelecionado)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-10 rounded-md border p-4 backdrop-blur" style={temaSelecionado.panelStyle}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/80">Fatura selecionada</p>
                    <Badge variant="outline" style={temaSelecionado.badgeStyle}>
                      {referenciaFaturaSelecionada?.descricao ?? "Sem ciclo"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-3xl font-semibold">{formatarMoeda(faturaSelecionadaTotal)}</p>
                  <p className="mt-4 text-xs text-white/70">
                    Use o seletor de fatura no topo para trocar o mês analisado deste cartão.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border px-4 py-3" style={temaSelecionado.metricStyle}>
                      <p className="text-xs text-white/70">Limite total</p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatarMoeda(limiteTotalCartaoSelecionado)}
                      </p>
                    </div>
                    <div className="rounded-md border px-4 py-3" style={temaSelecionado.metricStyle}>
                      <p className="text-xs text-white/70">Em uso agora</p>
                      <p className="mt-1 text-sm font-semibold">{formatarMoeda(totalComprometido)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Leitura rápida do ciclo</CardTitle>
                  <CardDescription>
                    Os indicadores abaixo ajudam a entender o momento do cartão sem mergulhar em cada linha.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md  border border-border/70 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Melhor dia de compra</p>
                    <p className="text-sm font-semibold">
                      {melhorDiaCompra ? `Dia ${melhorDiaCompra}` : "Configure o fechamento"}
                    </p>
                  </div>
                  <div className="rounded-md  border border-border/70 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Próximo vencimento</p>
                    <p className="text-sm font-semibold">
                      {proximoVencimento
                        ? new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          }).format(proximoVencimento)
                        : "Sem previsão"}
                    </p>
                  </div>
                  <div className="rounded-md  border border-border/70 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Status do limite</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={statusLimite.variant}>{statusLimite.rotulo}</Badge>
                    </div>
                  </div>
                  <div className="rounded-md  border border-border/70 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Ticket médio atual</p>
                    <p className="text-sm font-semibold">{formatarMoeda(ticketMedioAtual)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AgrupamentoMetricas
              titulo="Total comprometido"
              valor={formatarMoeda(totalComprometido)}
              descricao={
                referenciaComprometimentoAtual
                  ? `Uso atual do limite desde ${referenciaComprometimentoAtual.descricao}, incluindo fatura aberta e parcelas futuras.`
                  : "Uso atual do limite, incluindo fatura aberta e parcelas futuras."
              }
            />
            <AgrupamentoMetricas
              titulo="Este ciclo"
              valor={formatarMoeda(faturaSelecionadaTotal)}
              descricao={
                referenciaFaturaSelecionada
                  ? `Fatura de ${referenciaFaturaSelecionada.descricao}.`
                  : "Sem ciclo selecionado."
              }
              destaque="success"
            />
            <AgrupamentoMetricas
              titulo="Próxima fatura"
              valor={formatarMoeda(proximaFatura)}
              descricao={
                referenciaProximaFaturaSelecionada
                  ? `Compras projetadas para ${referenciaProximaFaturaSelecionada.descricao}.`
                  : "Sem projeção disponível."
              }
              destaque="warning"
            />
            <AgrupamentoMetricas
              titulo="Compras ativas"
              valor={String(parcelamentosAtivos.length)}
              descricao={`${parcelamentosAtivos.reduce(
                (total, item) => total + Math.max(item.parcelaTotal - item.parcelaAtual + 1, 0),
                0
              )} parcelas restantes em andamento.`}
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="rounded-md  border border-border/70 bg-card/70 p-2">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "faturas", label: "Faturas", icon: IconReceipt2 },
                  { id: "consolidado", label: "Consolidado", icon: IconTrendingUp },
                  { id: "parcelas", label: "Parcelas", icon: IconTarget },
                ].map((item) => {
                  const Icon = item.icon
                  const ativa = secaoAtiva === item.id

                  return (
                    <Button
                      key={item.id}
                      variant={ativa ? "default" : "ghost"}
                      size="lg"
                      onClick={() => setSecaoAtiva(item.id as SecaoCartoes)}
                      className={cn(
                        "rounded-md  px-3",
                        ativa ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                      {item.id === "parcelas" ? <Badge variant="success">Novo</Badge> : null}
                    </Button>
                  )
                })}
              </div>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 justify-between rounded-md border-border/70 bg-background px-4 text-left shadow-sm lg:min-w-[320px]"
                >
                  <div className="min-w-0">
                    <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">
                      Fatura selecionada
                    </p>
                    <p className="truncate text-sm font-medium capitalize">
                      {referenciaFaturaSelecionada?.descricao ?? "Escolha uma fatura"}
                    </p>
                  </div>
                  <IconChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={10} className="z-[99999] w-[360px] p-0">
                <div className="border-b border-border p-3">
                  <h3 className="text-sm font-medium text-foreground">Faturas do cartão</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Escolha o mês para atualizar totais, gastos e previsibilidade.
                  </p>
                </div>

                <div className="max-h-[360px] space-y-2 overflow-y-auto p-2">
                  {faturasNavegaveis.map((fatura) => {
                    const ativa = referenciaFaturaSelecionada?.chave === fatura.chave

                    return (
                      <button
                        key={fatura.chave}
                        type="button"
                        onClick={() => setFaturaSelecionadaChave(fatura.chave)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition",
                          ativa
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border/70 hover:border-primary/35 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px]  tracking-[0.18em] text-muted-foreground">
                              {formatarMesCurto(fatura.dataReferencia)}
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold capitalize">
                              {fatura.descricao}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {fatura.total > 0
                                ? "Compras consolidadas nesta fatura"
                                : "Sem compras importadas neste mês"}
                            </p>
                          </div>
                          {ativa ? (
                            <Badge>Selecionada</Badge>
                          ) : fatura.atual ? (
                            <Badge variant="secondary">Atual</Badge>
                          ) : null}
                        </div>
                        <p className="mt-3 text-lg font-semibold">{formatarMoeda(fatura.total)}</p>
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {secaoAtiva === "consolidado" ? (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.38fr)_minmax(360px,1fr)]">
                <Card className="min-w-0 border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconTrendingUp className="size-5 text-primary" />
                      Visão consolidada das faturas
                    </CardTitle>
                    <CardDescription>
                      A leitura parte do mês selecionado e projeta a evolução consolidada das faturas pelos próximos 12 meses.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historicoFaturas.length === 0 ? (
                      <div className="rounded-md  border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                        Selecione uma fatura para acompanhar a visão consolidada dos próximos meses.
                      </div>
                    ) : (
                      <ReactEChartsCore
                        echarts={echarts}
                        option={historicoFaturasOption}
                        style={{ height: 360 }}
                        notMerge
                        lazyUpdate
                      />
                    )}
                  </CardContent>
                </Card>

                <div className="min-w-0 space-y-4">
                  <Card className="min-w-0 border-border/70">
                    <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconChartDonut3 className="size-5 text-primary" />
                        Composição da fatura selecionada
                    </CardTitle>
                    <CardDescription>Entenda para onde o valor do mês escolhido está indo.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {distribuicaoCategorias.length === 0 ? (
                      <div className="rounded-md  border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                          Sem compras na fatura selecionada para compor o gráfico.
                      </div>
                    ) : (
                        <>
                          <ReactEChartsCore
                            echarts={echarts}
                            option={categoriasOption}
                            style={{ height: 300 }}
                            notMerge
                            lazyUpdate
                          />
                          <div className="mt-4 space-y-2">
                            {distribuicaoCategorias.slice(0, 4).map((item) => (
                              <div key={item.nome} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="size-2.5 rounded-md"
                                    style={{ backgroundColor: item.cor }}
                                  />
                                  <span>{item.nome}</span>
                                </div>
                                <span className="font-medium">{formatarMoeda(item.valor)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="min-w-0 border-border/70">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="size-5 text-primary" />
                        Insights do cartão
                      </CardTitle>
                      <CardDescription>Leituras rápidas que ajudam a agir antes da fatura fechar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-md  bg-muted/40 px-4 py-3">
                        <p className="text-sm font-medium">{statusLimite.rotulo}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{statusLimite.descricao}</p>
                      </div>
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">Categoria líder</p>
                        <p className="mt-1 text-sm font-semibold">
                          {categoriaPrincipal ? categoriaPrincipal.nome : "Sem categoria dominante"}
                        </p>
                      </div>
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">Maior estabelecimento</p>
                        <p className="mt-1 text-sm font-semibold">
                          {principalLoja ? principalLoja.nome : "Sem destaque nesta fatura"}
                        </p>
                      </div>
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">Parcelas futuras</p>
                        <p className="mt-1 text-sm font-semibold">{parcelamentosAtivos.length} compra(s) em aberto</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
                <Card className="min-w-0 border-border/70">
                <CardHeader>
                    <CardTitle>Top estabelecimentos da fatura</CardTitle>
                    <CardDescription>
                      Veja rapidamente quais lojas e serviços estão puxando o valor do mês selecionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topEstabelecimentos.length === 0 ? (
                      <div className="rounded-md  border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                        Nenhum estabelecimento disponível para análise nesta fatura.
                      </div>
                    ) : (
                      <ReactEChartsCore
                        echarts={echarts}
                        option={estabelecimentosOption}
                        style={{ height: 300 }}
                        notMerge
                        lazyUpdate
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="min-w-0 border-border/70">
                  <CardHeader>
                    <CardTitle>Faturas recentes</CardTitle>
                    <CardDescription>
                      Um resumo compacto das últimas faturas consolidadas deste cartão.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {faturasPorMes.slice(0, 5).map((fatura) => {
                      const ativa = referenciaFaturaSelecionada?.chave === fatura.chave

                      return (
                        <div
                          key={fatura.chave}
                          className={cn(
                            "rounded-md  border px-4 py-3 transition",
                            ativa ? "border-primary bg-primary/5" : "border-border/70"
                          )}
                          role="button"
                          tabIndex={0}
                          onClick={() => setFaturaSelecionadaChave(fatura.chave)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              setFaturaSelecionadaChave(fatura.chave)
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium capitalize">{fatura.descricao}</p>
                              <p className="text-xs text-muted-foreground">Fechamento consolidado</p>
                            </div>
                            {ativa ? <Badge>Selecionada</Badge> : null}
                          </div>
                          <p className="mt-3 text-lg font-semibold">{formatarMoeda(fatura.total)}</p>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {secaoAtiva === "faturas" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.32fr)_minmax(340px,0.92fr)]">
              <Card className="min-w-0 border-border/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconReceipt2 className="size-5 text-primary" />
                    Movimentações do cartão
                  </CardTitle>
                  <CardDescription>
                    Agora o detalhamento pode ser expandido para o usuário consultar o contexto de cada lançamento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-md  border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={escopoMovimentacao === "ciclo" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEscopoMovimentacao("ciclo")}
                      >
                        Fatura selecionada
                      </Button>
                      <Button
                        variant={escopoMovimentacao === "historico" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEscopoMovimentacao("historico")}
                      >
                        Histórico do cartão
                      </Button>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="relative w-full lg:max-w-sm">
                        <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={buscaMovimentacao}
                          onChange={(event) => setBuscaMovimentacao(event.target.value)}
                          placeholder="Buscar por descrição, categoria ou observação"
                          className="pl-9"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { id: "todas", label: "Todas" },
                          { id: "compras", label: "Compras" },
                          { id: "parceladas", label: "Parceladas" },
                          { id: "creditos", label: "Pagamentos / créditos" },
                        ].map((item) => (
                          <Button
                            key={item.id}
                            variant={filtroMovimentacao === item.id ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setFiltroMovimentacao(item.id as FiltroMovimentacao)}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{movimentacoesFiltradas.length} item(ns) encontrados</span>
                    <span>
                      {escopoMovimentacao === "ciclo"
                        ? referenciaFaturaSelecionada?.descricao ?? "Fatura selecionada"
                        : "Histórico completo"}
                    </span>
                  </div>

                  {movimentacoesFiltradas.length === 0 ? (
                    <div className="rounded-md  border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                      Nenhuma movimentação encontrada com esse filtro.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {movimentacoesFiltradas.map((transacao) => (
                        <LinhaTransacaoExpansivel
                          key={transacao.id}
                          transacao={transacao}
                          cartao={cartaoSelecionado}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="min-w-0 space-y-4">
                <Card className="min-w-0 border-border/70">
                <CardHeader>
                    <CardTitle>Resumo da fatura selecionada</CardTitle>
                    <CardDescription>Uma leitura rápida para orientar a revisão do mês escolhido.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md  border border-border/70 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Uso atual do limite</span>
                        <span className={cn("font-semibold", corUtilizacao(percentualUtilizado))}>
                          {percentualUtilizado.toFixed(0)}%
                        </span>
                      </div>
                      <Progress className="mt-3" value={Math.min(percentualUtilizado, 100)} />
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Limite {formatarMoeda(limiteTotalCartaoSelecionado)}</span>
                        <span>Livre estimado {formatarMoeda(limiteDisponivel)}</span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md  bg-muted/40 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Quantidade de compras</p>
                        <p className="mt-1 text-lg font-semibold">{transacoesFaturaSelecionada.length}</p>
                      </div>
                      <div className="rounded-md  bg-muted/40 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Ticket médio</p>
                        <p className="mt-1 text-lg font-semibold">{formatarMoeda(ticketMedioAtual)}</p>
                      </div>
                    </div>

                    {distribuicaoCategorias.length === 0 ? null : (
                      <ReactEChartsCore
                        echarts={echarts}
                        option={categoriasOption}
                        style={{ height: 280 }}
                        notMerge
                        lazyUpdate
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle>Pagamentos e créditos</CardTitle>
                    <CardDescription>
                      Movimentações não classificadas como despesa para este cartão.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pagamentosECreditos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum pagamento ou crédito identificado ainda.
                      </p>
                    ) : (
                      pagamentosECreditos.map((transacao) => (
                        <LinhaTransacaoExpansivel
                          key={transacao.id}
                          transacao={transacao}
                          cartao={cartaoSelecionado}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {secaoAtiva === "parcelas" ? (
            <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
              <Card className="min-w-0 border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconTarget className="size-5 text-primary" />
                      Projeção de compras parceladas
                    </CardTitle>
                    <CardDescription>
                      A nova visualização mostra a curva futura das parcelas para facilitar previsão de caixa.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {serieParcelas.every((item) => item.valor === 0) ? (
                      <div className="rounded-md  border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                        Nenhuma parcela futura prevista para este cartão.
                      </div>
                    ) : (
                      <ReactEChartsCore
                        echarts={echarts}
                        option={parcelasOption}
                        style={{ height: 340 }}
                        notMerge
                        lazyUpdate
                      />
                    )}
                  </CardContent>
                </Card>

              <div className="min-w-0 space-y-4">
                  <Card className="min-w-0 border-border/70">
                    <CardHeader>
                      <CardTitle>Resumo do limite</CardTitle>
                      <CardDescription>
                        Os principais números para acompanhar o uso atual e o saldo futuro do cartão.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Em uso agora</p>
                        <p className="mt-1 text-lg font-semibold">{formatarMoeda(totalComprometido)}</p>
                      </div>
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Próxima fatura projetada</p>
                        <p className="mt-1 text-lg font-semibold">{formatarMoeda(proximaFatura)}</p>
                      </div>
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs text-muted-foreground">Parcelas ativas</p>
                        <p className="mt-1 text-lg font-semibold">{parcelamentosAtivos.length}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70">
                    <CardHeader>
                      <CardTitle>Destaques</CardTitle>
                      <CardDescription>Contexto rápido para decidir se vale segurar novas compras longas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-md  bg-muted/40 px-4 py-3">
                        <p className="text-sm font-medium">
                          {parcelamentosAtivos.length > 0
                            ? `${parcelamentosAtivos[0].descricao} concentra o maior saldo restante.`
                            : "Sem parcelamentos em aberto no momento."}
                        </p>
                      </div>
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">Melhor dia de compra</p>
                        <p className="mt-1 text-sm font-semibold">
                          {melhorDiaCompra ? `Dia ${melhorDiaCompra}` : "Configure o fechamento"}
                        </p>
                      </div>
                      <div className="rounded-md  border border-border/70 px-4 py-3">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">Saúde do limite</p>
                        <div className="mt-1">
                          <Badge variant={statusLimite.variant}>{statusLimite.rotulo}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Compras parceladas</CardTitle>
                  <CardDescription>
                    Cada item pode ser expandido para revelar cronograma e contexto do parcelamento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {parcelamentosAtivos.length === 0 ? (
                    <div className="rounded-md  border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                      Nenhum parcelamento ativo encontrado para este cartão.
                    </div>
                  ) : (
                    parcelamentosAtivos.map((parcela) => (
                      <LinhaParcelaExpansivel key={parcela.id} parcela={parcela} />
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      <Sheet open={sheetAberta} onOpenChange={(open) => (!open ? fecharSheet() : setSheetAberta(true))}>
        <SheetContent className="flex h-full w-full flex-col overflow-hidden sm:max-w-md">
          <SheetHeader className="shrink-0">
            <SheetTitle>{cartaoEmEdicao ? "Editar cartão" : "Novo cartão de crédito"}</SheetTitle>
            <SheetDescription>
              {cartaoEmEdicao
                ? `Atualizando "${cartaoEmEdicao.nome}".`
                : "Adicione um cartão para acompanhar limite, fechamento e próximas faturas."}
            </SheetDescription>
          </SheetHeader>

          <form className="flex-1 space-y-5 overflow-y-auto p-6" onSubmit={handleSubmitCartao(onSubmitCartao)}>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome do cartão</Label>
              <Input placeholder="Ex: Inter Gold, Black principal..." {...registerCartao("nome")} />
              {errorsCartao.nome ? (
                <p className="text-xs text-destructive">{errorsCartao.nome.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Bandeira ou banco</Label>
              <Controller
                control={controlCartao}
                name="instituicao"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma instituição" />
                    </SelectTrigger>
                    <SelectContent>
                      {bancosDisponiveis.map((banco) => (
                        <SelectItem key={banco.id} value={banco.nome}>
                          <div className="flex items-center gap-2">
                            <LogoBanco instituicao={banco.nome} tamanho="sm" />
                            <span>{banco.nome}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errorsCartao.instituicao ? (
                <p className="text-xs text-destructive">{errorsCartao.instituicao.message}</p>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Limite do cartão em {moeda}</Label>
              <Controller
                control={controlCartao}
                name="limiteCredito"
                render={({ field }) => (
                  <CurrencyInput
                    placeholder={`${obterSimboloMoeda(moeda)} 0,00`}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              {errorsCartao.limiteCredito ? (
                <p className="text-xs text-destructive">{errorsCartao.limiteCredito.message}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                O limite ajuda a medir o uso da fatura e o saldo ainda disponível.
              </p>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Configuração da fatura</Label>
              <p className="text-xs text-muted-foreground">
                Defina fechamento e vencimento para organizar corretamente os próximos ciclos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Dia de fechamento</Label>
                <Input type="number" min="1" max="31" placeholder="Ex: 13" {...registerCartao("diaFechamento")} />
                {errorsCartao.diaFechamento ? (
                  <p className="text-xs text-destructive">{errorsCartao.diaFechamento.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Dia de vencimento</Label>
                <Input type="number" min="1" max="31" placeholder="Ex: 20" {...registerCartao("diaVencimento")} />
                {errorsCartao.diaVencimento ? (
                  <p className="text-xs text-destructive">{errorsCartao.diaVencimento.message}</p>
                ) : null}
              </div>
            </div>

            {mensagemSucesso ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{mensagemSucesso}</p>
            ) : null}
            {mensagemErro ? <p className="text-sm text-destructive">{mensagemErro}</p> : null}

            <Button className="w-full" disabled={isSubmittingCartao}>
              {isSubmittingCartao ? "Salvando..." : cartaoEmEdicao ? "Salvar alterações" : "Criar cartão"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
