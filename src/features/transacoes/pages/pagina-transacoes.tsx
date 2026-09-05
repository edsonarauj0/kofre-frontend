import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router-dom"
import { z } from "zod"
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowsTransferUpDown,
  IconCalendarMonth,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileImport,
  IconFilter,
  IconPigMoney,
  IconPlus,
  IconSearch,
  IconTrash,
  IconWallet,
} from "@tabler/icons-react"

import { useAuth } from "@/app/auth"
import { usePerfilFinanceiro } from "@/app/perfil-financeiro"
import {
  criarCategoriaApi,
  criarTransacaoApi,
  excluirTransacaoApi,
  listarCategoriasApi,
  listarTransacoesApi,
} from "@/features/transacoes/api/transacoes-api"
import { listarContasApi } from "@/features/contas/api/contas-api"
import { useTransacaoExplorer } from "@/features/transacoes/components/transacao-explorer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"
import { LogoBanco } from "@/shared/components/logo-banco"
import {
  formatarData,
  formatarMoeda,
  formatarNumeroDecimalFormulario,
  obterSimboloMoeda,
  parseValorDigitado,
} from "@/shared/lib/formatadores"
import type {
  TipoConta,
  Transacao,
} from "@/shared/types/financeiro"
import { cn } from "@/lib/utils"

const schema = z.object({
  descricao: z.string().min(3, "Informe uma descricao valida"),
  categoriaId: z.string().min(1, "Selecione uma categoria"),
  valor: z
    .string()
    .min(1, "Informe um valor")
    .refine(
      (valor) => parseValorDigitado(valor) > 0,
      "Informe um valor maior que zero"
    ),
  contaId: z.string().min(1, "Selecione uma conta"),
  tipo: z.enum(["RECEITA", "DESPESA", "TRANSFERENCIA"]),
  meioPagamento: z.string().optional(),
  recorrente: z.boolean(),
  statusPagamento: z.enum(["PENDENTE", "AGENDADO", "PAGO"]),
  dataLancamento: z.string().min(1, "Informe a data do lancamento"),
  dataVencimento: z.string().optional(),
  diaRecorrenciaMensal: z.string().optional(),
  dataAgendamentoPagamento: z.string().optional(),
  dataPagamento: z.string().optional(),
  contaPagamentoId: z.string().optional(),
  observacao: z.string().max(240, "Use no maximo 240 caracteres").optional(),
  parcelada: z.boolean(),
  quantidadeParcelas: z.string(),
  dividirTransacao: z.boolean(),
  divisoes: z.array(
    z.object({
      modo: z.enum(["perfil", "externo"]),
      perfilId: z.string().optional(),
      nome: z.string().optional(),
      percentual: z.string().optional(),
      valor: z.string().optional(),
    })
  ),
})

type FormularioTransacao = z.infer<typeof schema>
type DivisaoFormulario = FormularioTransacao["divisoes"][number]
type SecaoTransacoes = "movimentacoes" | "investimentos" | "transferencias"
type FiltroTipo = "TODOS" | "RECEITA" | "DESPESA" | "TRANSFERENCIA"
type FiltroRecorrencia = "TODOS" | "RECORRENTES" | "UNICA"
type FiltroStatusPagamento = "TODOS" | "PENDENTE" | "AGENDADO" | "PAGO" | "VENCIDOS"
type ModoDataTransacao = "LANCAMENTO" | "VENCIMENTO" | "PAGAMENTO"

const categoriasPadrao = [
  { nome: "Alimentacao", cor: "#14b8a6", icone: "shopping-cart" },
  { nome: "Transporte", cor: "#0891b2", icone: "car" },
  { nome: "Lazer", cor: "#f59e0b", icone: "sparkles" },
  { nome: "Renda", cor: "#22c55e", icone: "wallet" },
] as const

const valoresIniciaisFormulario: FormularioTransacao = {
  tipo: "DESPESA",
  dataLancamento: obterHojeIsoLocal(),
  observacao: "",
  descricao: "",
  categoriaId: "",
  contaId: "",
  valor: "",
  meioPagamento: "",
  recorrente: false,
  statusPagamento: "PENDENTE",
  dataVencimento: "",
  diaRecorrenciaMensal: "",
  dataAgendamentoPagamento: "",
  dataPagamento: "",
  contaPagamentoId: "",
  parcelada: false,
  quantidadeParcelas: "1",
  dividirTransacao: false,
  divisoes: [],
}

const secoesTransacoes: Array<{
  id: SecaoTransacoes
  rotulo: string
}> = [
    { id: "movimentacoes", rotulo: "Receitas/Despesas" },
    { id: "investimentos", rotulo: "Investimentos" },
    { id: "transferencias", rotulo: "Transferencias" },
  ]

function obterHojeIsoLocal() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, "0")
  const dia = String(agora.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function obterDataLocal(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

function ajustarDataParaDiaDoMes(dataIso: string, diaMes: string) {
  const dia = Number(diaMes)
  if (!dataIso || !Number.isInteger(dia) || dia < 1 || dia > 31) {
    return dataIso
  }

  const dataBase = obterDataLocal(dataIso)
  const ultimoDia = new Date(dataBase.getFullYear(), dataBase.getMonth() + 1, 0).getDate()
  dataBase.setDate(Math.min(dia, ultimoDia))
  const ano = dataBase.getFullYear()
  const mes = String(dataBase.getMonth() + 1).padStart(2, "0")
  const diaNormalizado = String(dataBase.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${diaNormalizado}`
}

function formatarMesAno(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(data)
}

function formatarDiaSemana(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(
    obterDataLocal(dataIso)
  )
}

function obterRotuloConta(tipo?: TipoConta) {
  switch (tipo) {
    case "cartao_credito":
      return "Cartao"
    case "corrente":
      return "Conta corrente"
    case "poupanca":
      return "Poupanca"
    case "investimento":
      return "Investimento"
    case "carteira":
      return "Carteira"
    case "cripto":
      return "Cripto"
    default:
      return "Conta"
  }
}

function obterCorValor(tipo: Transacao["tipo"]) {
  if (tipo === "receita") {
    return "text-emerald-600 dark:text-emerald-400"
  }

  if (tipo === "despesa") {
    return "text-rose-600 dark:text-rose-400"
  }

  return "text-foreground"
}

function escapeCsv(valor: string | number) {
  const texto = String(valor ?? "")
  return `"${texto.replaceAll('"', '""')}"`
}

function obterTipoInicialPorSecao(secaoAtiva: SecaoTransacoes) {
  if (secaoAtiva === "transferencias") {
    return "TRANSFERENCIA" as const
  }

  return "DESPESA" as const
}

function parseNumeroMoeda(valor: string) {
  return parseValorDigitado(valor)
}

function parseNumeroPercentual(valor: string) {
  return Number(valor.replace(",", "."))
}

function arredondarMoeda(valor: number) {
  return Math.round(valor * 100) / 100
}

function distribuirValoresPorPercentual(valorTotal: number, percentuais: number[]) {
  const totalCentavos = Math.round(valorTotal * 100)
  const candidatos = percentuais.map((percentual, indice) => {
    const valorBrutoCentavos = (totalCentavos * percentual) / 100
    const valorBase = Math.floor(valorBrutoCentavos)
    return {
      indice,
      valorBase,
      fracao: valorBrutoCentavos - valorBase,
    }
  })

  const totalBase = candidatos.reduce((total, candidato) => total + candidato.valorBase, 0)
  const centavosRestantes = totalCentavos - totalBase
  const ordenados = [...candidatos].sort((a, b) => {
    if (b.fracao !== a.fracao) {
      return b.fracao - a.fracao
    }
    return a.indice - b.indice
  })

  const centavosFinais = candidatos.map((candidato) => candidato.valorBase)
  for (let indice = 0; indice < centavosRestantes; indice += 1) {
    const candidato = ordenados[indice]
    if (!candidato) {
      break
    }
    centavosFinais[candidato.indice] += 1
  }

  return centavosFinais.map((centavos) => centavos / 100)
}

function calcularValorPorPercentual(valorTotal: number, percentualTexto?: string) {
  const percentual = parseNumeroPercentual(percentualTexto ?? "")
  if (!Number.isFinite(percentual) || percentual <= 0 || valorTotal <= 0) {
    return ""
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(arredondarMoeda((valorTotal * percentual) / 100))
}

function calcularPercentualPorValor(valorTotal: number, valorTexto?: string) {
  const valor = parseNumeroMoeda(valorTexto ?? "")
  if (!Number.isFinite(valor) || valor <= 0 || valorTotal <= 0) {
    return ""
  }

  return formatarNumeroDecimalFormulario(
    arredondarMoeda((valor / valorTotal) * 100)
  )
}

function obterValorIntegralLancamento(item: Transacao) {
  if (item.compartilhada && item.divisoes?.length) {
    return arredondarMoeda(item.divisoes.reduce((total, divisao) => total + divisao.valor, 0))
  }

  return item.valor
}

function obterParticipantesTransacao(item: Transacao) {
  return item.divisoes?.map((divisao) => divisao.perfilNome ?? divisao.nome).filter(Boolean) ?? []
}

function criarDivisaoPerfilAtual(perfilId: string, nome: string): DivisaoFormulario {
  return {
    modo: "perfil",
    perfilId,
    nome,
    percentual: "",
    valor: "",
  }
}

function criarDivisaoExterna(): DivisaoFormulario {
  return {
    modo: "externo",
    perfilId: "",
    nome: "",
    percentual: "",
    valor: "",
  }
}

type OpcaoMeioPagamento = { valor: string; rotulo: string }

function obterMeiosPagamentoPorConta(tipoConta?: string): OpcaoMeioPagamento[] {
  switch (tipoConta) {
    case "cartao_credito":
      return [{ valor: "CREDITO", rotulo: "Crédito" }]
    case "corrente":
    case "poupanca":
    case "carteira":
      return [
        { valor: "DEBITO", rotulo: "Débito" },
        { valor: "PIX", rotulo: "Pix" },
        { valor: "BOLETO", rotulo: "Boleto" },
      ]
    case "investimento":
    case "cripto":
      return [{ valor: "DEBITO", rotulo: "Débito" }]
    default:
      return [
        { valor: "DEBITO", rotulo: "Débito" },
        { valor: "CREDITO", rotulo: "Crédito" },
        { valor: "PIX", rotulo: "Pix" },
        { valor: "BOLETO", rotulo: "Boleto" },
      ]
  }
}

function calcularFaturaCartao(
  dataLancamento: string,
  diaFechamento: number
): { mes: string; descricao: string } {
  const [ano, mes, dia] = dataLancamento.split("-").map(Number)
  if (!ano || !mes || !dia) return { mes: "", descricao: "" }

  const diaCompra = dia
  let anoFatura = ano
  let mesFatura = mes

  // Se a compra for após o dia de fechamento, vai para a fatura do próximo mês
  if (diaCompra > diaFechamento) {
    mesFatura = mes + 1
    if (mesFatura > 12) {
      mesFatura = 1
      anoFatura = ano + 1
    }
  }

  const dataFatura = new Date(anoFatura, mesFatura - 1, 1)
  const descricao = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(dataFatura)
  return { mes: `${String(mesFatura).padStart(2, "0")}/${anoFatura}`, descricao }
}

function obterDataReferenciaTransacao(item: Transacao, modoData: ModoDataTransacao) {
  if (modoData === "VENCIMENTO") {
    return item.dataVencimento ?? item.data
  }
  if (modoData === "PAGAMENTO") {
    return item.dataPagamento ?? item.dataAgendamentoPagamento ?? item.data
  }
  return item.data
}

function statusEstaVencido(item: Transacao) {
  if (item.statusPagamento === "PAGO" || !item.dataVencimento) {
    return false
  }
  return obterDataLocal(item.dataVencimento).getTime() < obterDataLocal(obterHojeIsoLocal()).getTime()
}

function obterRotuloStatusPagamento(item: Transacao) {
  if (statusEstaVencido(item)) {
    return item.tipo === "receita" ? "A receber vencida" : "Vencida"
  }
  switch (item.statusPagamento) {
    case "AGENDADO":
      return item.tipo === "receita" ? "Recebimento agendado" : "Agendado"
    case "PENDENTE":
      return item.tipo === "receita" ? "A receber" : "A pagar"
    case "PAGO":
      return item.tipo === "receita" ? "Recebido" : "Pago"
    default:
      return "Pago"
  }
}

function obterVariantStatusPagamento(item: Transacao): React.ComponentProps<typeof Badge>["variant"] {
  if (statusEstaVencido(item)) {
    return "destructive"
  }
  switch (item.statusPagamento) {
    case "AGENDADO":
      return "warning"
    case "PENDENTE":
      return "outline"
    case "PAGO":
    default:
      return "success"
  }
}

export function PaginaTransacoes() {
  const { moeda } = useAuth()
  const { perfilAtivo, perfis } = usePerfilFinanceiro()
  const navigate = useNavigate()
  const { abrirTransacao } = useTransacaoExplorer()
  const queryClient = useQueryClient()
  const bootstrapCategoriasExecutado = React.useRef(false)
  const [busca, setBusca] = React.useState("")
  const [aberto, setAberto] = React.useState(false)
  const [secaoAtiva, setSecaoAtiva] =
    React.useState<SecaoTransacoes>("movimentacoes")
  const [filtrosAbertos, setFiltrosAbertos] = React.useState(false)
  const [importacaoAberta, setImportacaoAberta] = React.useState(false)
  const [mesReferencia, setMesReferencia] = React.useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const [filtroTipo, setFiltroTipo] = React.useState<FiltroTipo>("TODOS")
  const [filtroContaId, setFiltroContaId] = React.useState("TODAS")
  const [filtroCategoriaId, setFiltroCategoriaId] = React.useState("TODAS")
  const [filtroRecorrencia, setFiltroRecorrencia] =
    React.useState<FiltroRecorrencia>("TODOS")
  const [filtroStatusPagamento, setFiltroStatusPagamento] =
    React.useState<FiltroStatusPagamento>("TODOS")
  const [modoData, setModoData] = React.useState<ModoDataTransacao>("LANCAMENTO")
  const [filtroParticipante, setFiltroParticipante] = React.useState("")
  const [selecionadas, setSelecionadas] = React.useState<string[]>([])
  const [paginaAtual, setPaginaAtual] = React.useState(1)
  const [confirmacaoExclusaoEmLoteAberta, setConfirmacaoExclusaoEmLoteAberta] = React.useState(false)
  const [erroFormularioAvancado, setErroFormularioAvancado] = React.useState<string | null>(
    null
  )

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
    queryFn: () =>
      listarTransacoesApi(categoriasQuery.data ?? [], contasQuery.data ?? []),
    enabled: Boolean(contasQuery.data && categoriasQuery.data),
  })

  const criarCategoriaMutation = useMutation({
    mutationFn: criarCategoriaApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categorias"] })
    },
  })

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormularioTransacao>({
    resolver: zodResolver(schema),
    defaultValues: valoresIniciaisFormulario,
  })
  const origemUltimaEdicaoDivisao = React.useRef<Record<number, "percentual" | "valor">>({})

  const { fields: divisaoFields, append, remove, replace } = useFieldArray({
    control,
    name: "divisoes",
  })

  const criarTransacaoMutation = useMutation({
    mutationFn: criarTransacaoApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transacoes"] })
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      setAberto(false)
    },
  })

  const resetarFormulario = React.useCallback(() => {
    setErroFormularioAvancado(null)
    reset({
      ...valoresIniciaisFormulario,
      dataLancamento: obterHojeIsoLocal(),
      tipo: obterTipoInicialPorSecao(secaoAtiva),
    })
  }, [reset, secaoAtiva])

  const lidarMudancaAberturaFormulario = React.useCallback(
    (proximoAberto: boolean) => {
      if (proximoAberto) {
        resetarFormulario()
      }

      setAberto(proximoAberto)

      if (!proximoAberto) {
        resetarFormulario()
      }
    },
    [resetarFormulario]
  )

  React.useEffect(() => {
    if (
      categoriasQuery.isSuccess &&
      categoriasQuery.data.length === 0 &&
      !bootstrapCategoriasExecutado.current
    ) {
      bootstrapCategoriasExecutado.current = true
      void Promise.all(
        categoriasPadrao.map((categoria) =>
          criarCategoriaMutation.mutateAsync({
            nome: categoria.nome,
            cor: categoria.cor,
            icone: categoria.icone,
          })
        )
      )
    }
  }, [categoriasQuery.data, categoriasQuery.isSuccess, criarCategoriaMutation])

  const contas = contasQuery.data ?? []
  const categorias = categoriasQuery.data ?? []
  const transacoes = transacoesQuery.data ?? []
  const tipoFormulario = watch("tipo")
  const parcelada = watch("parcelada")
  const dividirTransacao = watch("dividirTransacao")
  const valorFormulario = watch("valor")
  const divisoesFormulario = watch("divisoes")
  const statusPagamentoFormulario = watch("statusPagamento")
  const contaIdFormulario = watch("contaId")
  const dataLancamentoFormulario = watch("dataLancamento")
  const recorrenteFormulario = watch("recorrente")
  const diaRecorrenciaMensalFormulario = watch("diaRecorrenciaMensal")
  const ehDespesa = tipoFormulario === "DESPESA"
  const ehReceita = tipoFormulario === "RECEITA"
  const contaPagamentoIdFormulario = watch("contaPagamentoId")

  const contaSelecionadaFormulario = React.useMemo(
    () => contas.find((c) => c.id === contaIdFormulario),
    [contas, contaIdFormulario]
  )

  const contasDisponiveisFormulario = React.useMemo(() => {
    if (ehDespesa) {
      return contas
    }

    return contas.filter((conta) => conta.tipo !== "cartao_credito")
  }, [contas, ehDespesa])

  const meiosPagamentoDisponiveis = React.useMemo(
    () => (ehDespesa ? obterMeiosPagamentoPorConta(contaSelecionadaFormulario?.tipo) : []),
    [contaSelecionadaFormulario, ehDespesa]
  )

  const contasPagamentoDisponiveis = React.useMemo(
    () => contas.filter((conta) => conta.tipo !== "cartao_credito"),
    [contas]
  )

  const faturaCalculada = React.useMemo(() => {
    if (
      contaSelecionadaFormulario?.tipo === "cartao_credito" &&
      contaSelecionadaFormulario.diaFechamento &&
      dataLancamentoFormulario
    ) {
      return calcularFaturaCartao(dataLancamentoFormulario, contaSelecionadaFormulario.diaFechamento)
    }
    return null
  }, [contaSelecionadaFormulario, dataLancamentoFormulario])

  React.useEffect(() => {
    if (secaoAtiva === "transferencias") {
      setValue("tipo", "TRANSFERENCIA")
      setValue("statusPagamento", "PAGO")
    }
  }, [secaoAtiva, setValue])

  // Auto-seleciona meio de pagamento quando a conta muda
  React.useEffect(() => {
    if (!ehDespesa) {
      setValue("meioPagamento", "")
      return
    }

    const meios = obterMeiosPagamentoPorConta(contaSelecionadaFormulario?.tipo)
    const primeirMeio = meios[0]?.valor ?? ""
    setValue("meioPagamento", primeirMeio)
  }, [contaSelecionadaFormulario, ehDespesa, setValue])

  React.useEffect(() => {
    if (tipoFormulario === "TRANSFERENCIA") {
      setValue("statusPagamento", "PAGO")
      setValue("dataVencimento", "")
      setValue("dataAgendamentoPagamento", "")
      setValue("dataPagamento", dataLancamentoFormulario || obterHojeIsoLocal())
      setValue("contaPagamentoId", "")
      return
    }

    if (statusPagamentoFormulario === "PAGO" && !getValues("dataPagamento")) {
      setValue("dataPagamento", dataLancamentoFormulario || obterHojeIsoLocal())
    }

    if (statusPagamentoFormulario === "AGENDADO" && !getValues("dataAgendamentoPagamento")) {
      setValue(
        "dataAgendamentoPagamento",
        getValues("dataVencimento") || dataLancamentoFormulario || obterHojeIsoLocal()
      )
    }

    if (statusPagamentoFormulario !== "PAGO") {
      setValue("dataPagamento", "")
    }

    if (statusPagamentoFormulario !== "AGENDADO") {
      setValue("dataAgendamentoPagamento", "")
    }

    if (
      contaSelecionadaFormulario?.tipo === "cartao_credito" &&
      statusPagamentoFormulario === "PAGO" &&
      !contaPagamentoIdFormulario
    ) {
      const contaSugestao = contasPagamentoDisponiveis[0]
      if (contaSugestao) {
        setValue("contaPagamentoId", contaSugestao.id)
      }
    }
  }, [
    contaPagamentoIdFormulario,
    contaSelecionadaFormulario?.tipo,
    contasPagamentoDisponiveis,
    dataLancamentoFormulario,
    getValues,
    setValue,
    statusPagamentoFormulario,
    tipoFormulario,
  ])

  React.useEffect(() => {
    if (!dividirTransacao || !perfilAtivo) {
      if (!dividirTransacao && getValues("divisoes").length > 0) {
        replace([])
      }
      return
    }

    const atuais = getValues("divisoes")
    if (atuais.length === 0) {
      replace([
        criarDivisaoPerfilAtual(perfilAtivo.id, perfilAtivo.nome),
        criarDivisaoExterna(),
      ])
      return
    }

    const primeira = atuais[0]
    if (primeira?.perfilId !== perfilAtivo.id || primeira?.modo !== "perfil") {
      replace([
        {
          ...primeira,
          modo: "perfil",
          perfilId: perfilAtivo.id,
          nome: perfilAtivo.nome,
        },
        ...atuais.slice(1),
      ])
    }
  }, [dividirTransacao, getValues, perfilAtivo, replace])

  React.useEffect(() => {
    const categoriaAtual = getValues("categoriaId")
    if (!categoriaAtual) {
      return
    }

    const categoriaSelecionada = categorias.find((categoria) => categoria.id === categoriaAtual)
    if (!categoriaSelecionada || categoriaSelecionada.tipo !== tipoFormulario) {
      setValue("categoriaId", "")
    }
  }, [categorias, getValues, setValue, tipoFormulario])

  React.useEffect(() => {
    if (tipoFormulario !== "DESPESA" && parcelada) {
      setValue("parcelada", false)
      setValue("quantidadeParcelas", "1")
    }

    if (tipoFormulario !== "DESPESA" && dividirTransacao) {
      setValue("dividirTransacao", false)
    }

    if (tipoFormulario !== "DESPESA" && contaSelecionadaFormulario?.tipo === "cartao_credito") {
      setValue("contaId", "")
    }
  }, [contaSelecionadaFormulario?.tipo, dividirTransacao, parcelada, setValue, tipoFormulario])

  React.useEffect(() => {
    if (!ehDespesa || !recorrenteFormulario) {
      if (diaRecorrenciaMensalFormulario) {
        setValue("diaRecorrenciaMensal", "")
      }
      return
    }

    if (diaRecorrenciaMensalFormulario && dataLancamentoFormulario && !getValues("dataVencimento")) {
      setValue(
        "dataVencimento",
        ajustarDataParaDiaDoMes(dataLancamentoFormulario, diaRecorrenciaMensalFormulario)
      )
    }
  }, [
    dataLancamentoFormulario,
    diaRecorrenciaMensalFormulario,
    ehDespesa,
    getValues,
    recorrenteFormulario,
    setValue,
  ])

  const categoriasDisponiveis = React.useMemo(() => {
    return categorias.filter((categoria) => {
      if (secaoAtiva === "investimentos") {
        return categoria.tipo === "INVESTIMENTO"
      }

      if (secaoAtiva === "transferencias") {
        return categoria.tipo === "TRANSFERENCIA"
      }

      return categoria.tipo === "DESPESA" || categoria.tipo === "RECEITA"
    })
  }, [categorias, secaoAtiva])

  const categoriasFormulario = React.useMemo(
    () => categorias.filter((categoria) => categoria.tipo === tipoFormulario),
    [categorias, tipoFormulario]
  )

  const perfisRelacionados = React.useMemo(
    () => perfis.filter((perfil) => perfil.id !== perfilAtivo?.id),
    [perfilAtivo?.id, perfis]
  )

  const totalDivididoFormulario = React.useMemo(
    () =>
      divisoesFormulario.reduce((total, divisao) => {
        const valor = parseNumeroMoeda(divisao.valor ?? "")
        return Number.isFinite(valor) ? total + valor : total
      }, 0),
    [divisoesFormulario]
  )

  const totalFormulario = React.useMemo(() => {
    const valor = parseNumeroMoeda(valorFormulario ?? "")
    return Number.isFinite(valor) ? valor : 0
  }, [valorFormulario])

  React.useEffect(() => {
    if (!dividirTransacao || totalFormulario <= 0) {
      return
    }

    divisoesFormulario.forEach((divisao, indice) => {
      const origem = origemUltimaEdicaoDivisao.current[indice]
      if (origem === "percentual") {
        const valorCalculado = calcularValorPorPercentual(totalFormulario, divisao.percentual)
        if ((divisao.valor ?? "") !== valorCalculado) {
          setValue(`divisoes.${indice}.valor`, valorCalculado, { shouldDirty: true })
        }
      }

      if (origem === "valor") {
        const percentualCalculado = calcularPercentualPorValor(totalFormulario, divisao.valor)
        if ((divisao.percentual ?? "") !== percentualCalculado) {
          setValue(`divisoes.${indice}.percentual`, percentualCalculado, { shouldDirty: true })
        }
      }
    })
  }, [dividirTransacao, divisoesFormulario, setValue, totalFormulario])

  const transacoesFiltradas = React.useMemo(() => {
    return transacoes
      .filter((item) => {
        const data = obterDataLocal(obterDataReferenciaTransacao(item, modoData))
        return (
          data.getMonth() === mesReferencia.getMonth() &&
          data.getFullYear() === mesReferencia.getFullYear()
        )
      })
      .filter((item) => {
        if (secaoAtiva === "investimentos") {
          return (
            item.categoriaTipo === "INVESTIMENTO" || item.contaTipo === "investimento"
          )
        }

        if (secaoAtiva === "transferencias") {
          return (
            item.tipo === "transferencia" || item.categoriaTipo === "TRANSFERENCIA"
          )
        }

        return item.tipo === "receita" || item.tipo === "despesa"
      })
      .filter((item) => {
        if (filtroTipo === "TODOS") {
          return true
        }

        return item.tipo === filtroTipo.toLowerCase()
      })
      .filter((item) => (filtroContaId === "TODAS" ? true : item.contaId === filtroContaId))
      .filter((item) =>
        filtroCategoriaId === "TODAS" ? true : item.categoriaId === filtroCategoriaId
      )
      .filter((item) => {
        if (filtroRecorrencia === "TODOS") {
          return true
        }

        return filtroRecorrencia === "RECORRENTES" ? item.recorrente : !item.recorrente
      })
      .filter((item) => {
        if (filtroStatusPagamento === "TODOS") {
          return true
        }

        if (filtroStatusPagamento === "VENCIDOS") {
          return statusEstaVencido(item)
        }

        return item.statusPagamento === filtroStatusPagamento
      })
      .filter((item) => {
        if (!filtroParticipante.trim()) {
          return true
        }

        const termo = filtroParticipante.trim().toLowerCase()
        return obterParticipantesTransacao(item).some((participante) =>
          participante.toLowerCase().includes(termo)
        )
      })
      .filter((item) => {
        const alvo = [
          item.descricao,
          item.categoria,
          item.subcategoria,
          item.conta,
          item.tag,
          ...obterParticipantesTransacao(item),
        ]
          .join(" ")
          .toLowerCase()

        return alvo.includes(busca.toLowerCase())
      })
      .sort(
        (a, b) =>
          obterDataLocal(obterDataReferenciaTransacao(b, modoData)).getTime() -
          obterDataLocal(obterDataReferenciaTransacao(a, modoData)).getTime()
      )
  }, [
    transacoes,
    mesReferencia,
    secaoAtiva,
    filtroTipo,
    filtroContaId,
    filtroCategoriaId,
    filtroRecorrencia,
    filtroStatusPagamento,
    busca,
    filtroParticipante,
    modoData,
  ])

  const ITENS_POR_PAGINA = 20

  const totalPaginas = Math.max(1, Math.ceil(transacoesFiltradas.length / ITENS_POR_PAGINA))

  React.useEffect(() => {
    setPaginaAtual(1)
  }, [
    busca,
    filtroCategoriaId,
    filtroContaId,
    filtroRecorrencia,
    filtroStatusPagamento,
    filtroTipo,
    mesReferencia,
    modoData,
    secaoAtiva,
  ])

  const transacoesPaginadas = React.useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return transacoesFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [transacoesFiltradas, paginaAtual])

  React.useEffect(() => {
    setSelecionadas((atual) => {
      const proximas = atual.filter((id) =>
        transacoesFiltradas.some((item) => item.id === id)
      )

      if (
        proximas.length === atual.length &&
        proximas.every((item, indice) => item === atual[indice])
      ) {
        return atual
      }

      return proximas
    })
  }, [transacoesFiltradas])

  const transacoesAgrupadas = React.useMemo(() => {
    const grupos = new Map<
      string,
      {
        data: string
        itens: Transacao[]
        total: number
      }
    >()

    transacoesPaginadas.forEach((item) => {
      const dataReferencia = obterDataReferenciaTransacao(item, modoData)
      const grupo = grupos.get(dataReferencia)
      if (grupo) {
        grupo.itens.push(item)
        grupo.total += item.tipo === "receita" ? item.valor : -item.valor
        return
      }

      grupos.set(dataReferencia, {
        data: dataReferencia,
        itens: [item],
        total: item.tipo === "receita" ? item.valor : -item.valor,
      })
    })

    return Array.from(grupos.values()).sort(
      (a, b) => obterDataLocal(b.data).getTime() - obterDataLocal(a.data).getTime()
    )
  }, [modoData, transacoesPaginadas])

  const totais = React.useMemo(() => {
    const receitas = transacoesFiltradas
      .filter((item) => item.tipo === "receita")
      .reduce((total, item) => total + item.valor, 0)
    const despesasMinhaParte = transacoesFiltradas
      .filter((item) => item.tipo === "despesa")
      .reduce((total, item) => total + item.valor, 0)
    const despesasTotais = transacoesFiltradas
      .filter((item) => item.tipo === "despesa")
      .reduce((total, item) => total + obterValorIntegralLancamento(item), 0)
    const saldo = receitas - despesasMinhaParte

    return {
      receitas,
      despesasMinhaParte,
      despesasTotais,
      saldo,
      quantidade: transacoesFiltradas.length,
    }
  }, [transacoesFiltradas])

  const quantidadeFiltrosAtivos = [
    filtroTipo !== "TODOS",
    filtroContaId !== "TODAS",
    filtroCategoriaId !== "TODAS",
    filtroRecorrencia !== "TODOS",
    filtroStatusPagamento !== "TODOS",
    filtroParticipante.trim().length > 0,
  ].filter(Boolean).length

  const todasPaginadasSelecionadas =
    transacoesPaginadas.length > 0 &&
    transacoesPaginadas.every((item) => selecionadas.includes(item.id))

  const transacoesSelecionadas = transacoesFiltradas.filter((item) =>
    selecionadas.includes(item.id)
  )

  const contasPorId = React.useMemo(
    () => new Map(contas.map((conta) => [conta.id, conta])),
    [contas]
  )

  const exportarTransacoes = () => {
    const base = transacoesSelecionadas.length > 0 ? transacoesSelecionadas : transacoesFiltradas
    if (base.length === 0 || typeof window === "undefined") {
      return
    }

    const linhas = [
      [
        "descricao",
        "tipo",
        "categoria",
        "conta",
        "data",
        "status_pagamento",
        "data_vencimento",
        "data_agendamento_pagamento",
        "data_pagamento",
        "valor",
        "recorrente",
      ].join(","),
      ...base.map((item) =>
        [
          escapeCsv(item.descricao),
          escapeCsv(item.tipo),
          escapeCsv(item.categoria),
          escapeCsv(item.conta),
          escapeCsv(item.data),
          escapeCsv(item.statusPagamento ?? "PAGO"),
          escapeCsv(item.dataVencimento ?? ""),
          escapeCsv(item.dataAgendamentoPagamento ?? ""),
          escapeCsv(item.dataPagamento ?? ""),
          escapeCsv(item.valor.toFixed(2)),
          escapeCsv(item.recorrente ? "sim" : "nao"),
        ].join(",")
      ),
    ]

    const blob = new Blob([linhas.join("\n")], {
      type: "text/csv;charset=utf-8;",
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `transacoes-${mesReferencia.getFullYear()}-${String(
      mesReferencia.getMonth() + 1
    ).padStart(2, "0")}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const avancarMes = (direcao: -1 | 1) => {
    setMesReferencia(
      (atual) => new Date(atual.getFullYear(), atual.getMonth() + direcao, 1)
    )
  }

  const alternarSelecao = (transacaoId: string) => {
    setSelecionadas((atual) =>
      atual.includes(transacaoId)
        ? atual.filter((id) => id !== transacaoId)
        : [...atual, transacaoId]
    )
  }

  const alternarSelecionarTodas = () => {
    if (todasPaginadasSelecionadas) {
      setSelecionadas((atual) =>
        atual.filter((id) => !transacoesPaginadas.some((item) => item.id === id))
      )
      return
    }

    setSelecionadas((atual) => [
      ...new Set([...atual, ...transacoesPaginadas.map((item) => item.id)]),
    ])
  }

  const excluirEmLoteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => excluirTransacaoApi(id)))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transacoes"] })
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      setSelecionadas([])
      setConfirmacaoExclusaoEmLoteAberta(false)
    },
  })

  const limparFiltros = () => {
    setFiltroTipo("TODOS")
    setFiltroContaId("TODAS")
    setFiltroCategoriaId("TODAS")
    setFiltroRecorrencia("TODOS")
    setFiltroStatusPagamento("TODOS")
    setFiltroParticipante("")
  }

  const onSubmit = async (valores: FormularioTransacao) => {
    setErroFormularioAvancado(null)

    const valorTotal = arredondarMoeda(parseNumeroMoeda(valores.valor))
    const quantidadeParcelas = valores.parcelada
      ? Math.max(1, Number(valores.quantidadeParcelas || "1"))
      : 1

    if (valores.parcelada && valores.tipo !== "DESPESA") {
      setErroFormularioAvancado("O parcelamento esta disponivel apenas para despesas.")
      return
    }

    if (
      valores.tipo === "DESPESA" &&
      contaSelecionadaFormulario?.tipo === "cartao_credito" &&
      valores.statusPagamento === "PAGO" &&
      !valores.contaPagamentoId
    ) {
      setErroFormularioAvancado("Selecione a conta que quitou a fatura para marcar a despesa como paga.")
      return
    }

    let divisoesPayload:
      | Array<{
        nome?: string
        valor: number
        percentual?: number
        perfilId?: string
      }>
      | null = null

    if (valores.dividirTransacao) {
      if (!perfilAtivo) {
        setErroFormularioAvancado("Nenhum perfil financeiro ativo foi encontrado para dividir a transacao.")
        return
      }

      const usaPercentual = valores.divisoes.some((divisao) => {
        const percentual = parseNumeroPercentual(divisao.percentual ?? "")
        return Number.isFinite(percentual) && percentual > 0
      })

      const percentuaisNormalizados = valores.divisoes.map((divisao) => {
        const percentual = parseNumeroPercentual(divisao.percentual ?? "")
        return Number.isFinite(percentual) ? percentual : 0
      })

      if (usaPercentual) {
        const possuiPercentualInvalido = percentuaisNormalizados.some((percentual) => percentual <= 0)
        if (possuiPercentualInvalido) {
          setErroFormularioAvancado("Quando usar percentual, informe um percentual maior que zero para todos os participantes.")
          return
        }

        const somaPercentuais = percentuaisNormalizados.reduce((total, percentual) => total + percentual, 0)
        if (Math.abs(somaPercentuais - 100) > 0.01) {
          setErroFormularioAvancado("A soma dos percentuais precisa ser igual a 100%.")
          return
        }
      }

      const valoresPorPercentual = usaPercentual
        ? distribuirValoresPorPercentual(valorTotal, percentuaisNormalizados)
        : []

      const divisoesNormalizadas = valores.divisoes
        .map((divisao, indice) => {
          const valor = usaPercentual
            ? arredondarMoeda(valoresPorPercentual[indice] ?? 0)
            : arredondarMoeda(parseNumeroMoeda(divisao.valor ?? ""))
          const percentual = usaPercentual ? Number(percentuaisNormalizados[indice]?.toFixed(2)) : undefined
          const perfilId =
            indice === 0 ? perfilAtivo.id : divisao.modo === "perfil" ? divisao.perfilId : undefined
          const nome =
            indice === 0
              ? perfilAtivo.nome
              : divisao.modo === "externo"
                ? divisao.nome?.trim()
                : undefined

          return {
            perfilId,
            nome,
            valor,
            percentual,
            modo: indice === 0 ? "perfil" : divisao.modo,
          }
        })
        .filter((divisao) => divisao.valor > 0 || divisao.perfilId || divisao.nome || divisao.percentual)

      if (divisoesNormalizadas.length < 2) {
        setErroFormularioAvancado("Adicione ao menos a sua parte e mais um participante para dividir a transacao.")
        return
      }

      const divisaoAtual = divisoesNormalizadas.find((divisao) => divisao.perfilId === perfilAtivo.id)
      if (!divisaoAtual) {
        setErroFormularioAvancado("A divisao precisa incluir a parte do perfil atual.")
        return
      }

      const perfisUsados = new Set<string>()

      for (const divisao of divisoesNormalizadas) {
        if (divisao.valor <= 0) {
          setErroFormularioAvancado("Cada participante da divisao precisa ter um valor maior que zero.")
          return
        }

        if (divisao.modo === "perfil" && !divisao.perfilId) {
          setErroFormularioAvancado("Selecione o perfil para cada participante interno.")
          return
        }

        if (divisao.perfilId) {
          if (perfisUsados.has(divisao.perfilId)) {
            setErroFormularioAvancado("Nao repita o mesmo perfil na divisao da transacao.")
            return
          }
          perfisUsados.add(divisao.perfilId)
        }

        if (divisao.modo === "externo" && !divisao.nome) {
          setErroFormularioAvancado("Informe o nome de cada participante externo.")
          return
        }
      }

      const totalDividido = arredondarMoeda(
        divisoesNormalizadas.reduce((total, divisao) => total + divisao.valor, 0)
      )

      if (Math.abs(totalDividido - valorTotal) > 0.009) {
        setErroFormularioAvancado("A soma das divisoes precisa ser igual ao valor total da transacao.")
        return
      }

      divisoesPayload = divisoesNormalizadas.map((divisao) => ({
        perfilId: divisao.perfilId,
        nome: divisao.nome,
        valor: divisao.valor,
        percentual: divisao.percentual,
      }))
    }

    const diaRecorrenciaMensal =
      valores.recorrente && valores.tipo === "DESPESA" && valores.diaRecorrenciaMensal
        ? Number(valores.diaRecorrenciaMensal)
        : null

    if (
      diaRecorrenciaMensal !== null &&
      (!Number.isInteger(diaRecorrenciaMensal) || diaRecorrenciaMensal < 1 || diaRecorrenciaMensal > 31)
    ) {
      setErroFormularioAvancado("Informe um dia fixo da cobranca entre 1 e 31.")
      return
    }

    await criarTransacaoMutation.mutateAsync({
      descricao: valores.descricao,
      tipo: valores.tipo,
      valor: valorTotal,
      dataLancamento: valores.dataLancamento,
      observacao: valores.observacao,
      recorrente: valores.recorrente,
      meioPagamento: valores.meioPagamento ?? null,
      contaId: valores.contaId,
      categoriaId: valores.categoriaId,
      statusPagamento: valores.tipo === "TRANSFERENCIA" ? "PAGO" : valores.statusPagamento,
      dataVencimento: valores.dataVencimento || null,
      diaRecorrenciaMensal,
      dataAgendamentoPagamento:
        valores.statusPagamento === "AGENDADO"
          ? valores.dataAgendamentoPagamento || null
          : null,
      dataPagamento:
        valores.tipo === "TRANSFERENCIA" || valores.statusPagamento === "PAGO"
          ? valores.dataPagamento || valores.dataLancamento
          : null,
      contaPagamentoId:
        valores.tipo === "TRANSFERENCIA" ? null : valores.contaPagamentoId || null,
      quantidadeParcelas:
        valores.parcelada && quantidadeParcelas > 1 ? quantidadeParcelas : null,
      divisoes: divisoesPayload,
    })
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo=""
        descricao=""
        acoes={
          <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background p-1">
            {secoesTransacoes.map((secao) => (
              <Button
                key={secao.id}
                size="sm"
                variant={secaoAtiva === secao.id ? "secondary" : "ghost"}
                onClick={() => setSecaoAtiva(secao.id)}
              >
                {secao.rotulo}
              </Button>
            ))}
          </div>
        }
      />

      <Card className="border-border/70">
        <CardContent className="space-y-6 p-5">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              placeholder="Buscar transacoes por descricao, conta, categoria, tag ou participante"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button size="icon-sm" variant="ghost" onClick={() => avancarMes(-1)}>
                <IconArrowLeft className="size-3.5" />
              </Button>
              <div className="min-w-44">
                <p className="text-base font-semibold capitalize">
                  {formatarMesAno(mesReferencia)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {transacoesFiltradas.length} itens em{" "}
                  {modoData === "LANCAMENTO"
                    ? "lancamento"
                    : modoData === "VENCIMENTO"
                      ? "vencimento"
                      : "pagamento"}
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => avancarMes(1)}>
                <IconArrowRight className="size-3.5" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={modoData} onValueChange={(valor) => setModoData(valor as ModoDataTransacao)}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LANCAMENTO">Calendario de lancamento</SelectItem>
                  <SelectItem value="VENCIMENTO">Calendario de vencimento</SelectItem>
                  <SelectItem value="PAGAMENTO">Calendario de pagamento</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant={filtrosAbertos ? "secondary" : "outline"}
                onClick={() => setFiltrosAbertos((atual) => !atual)}
              >
                <IconFilter className="size-3.5" />
                Filtros
                {quantidadeFiltrosAtivos > 0 ? (
                  <Badge variant="secondary">{quantidadeFiltrosAtivos}</Badge>
                ) : null}
              </Button>

              <Dialog open={importacaoAberta} onOpenChange={setImportacaoAberta}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setImportacaoAberta(true)}
                >
                  <IconFileImport className="size-3.5" />
                  Importar
                </Button>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Importar lancamentos</DialogTitle>
                    <DialogDescription>
                      Escolha como deseja trazer novos registros para o sistema.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3">
                    <div className="border border-border/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            Importar fatura com IA
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Envie a fatura do cartao para a IA ler, categorizar e
                            montar o rascunho antes de processar.
                          </p>
                        </div>
                        <Badge variant="secondary">Recomendado</Badge>
                      </div>
                      <Button
                        className="mt-4"
                        onClick={() => {
                          setImportacaoAberta(false)
                          navigate("/ia")
                        }}
                      >
                        Abrir importacao com IA
                      </Button>
                    </div>

                    <div className="border border-border/70 p-4">
                      <p className="text-sm font-semibold">Lancamento manual em lote</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Para registros pontuais, continue usando o cadastro manual.
                        Em breve podemos expandir isso para importacao via arquivo.
                      </p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => {
                          setImportacaoAberta(false)
                          setAberto(true)
                        }}
                      >
                        Abrir cadastro manual
                      </Button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setImportacaoAberta(false)}
                    >
                      Fechar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                size="sm"
                variant="outline"
                disabled={transacoesFiltradas.length === 0}
                onClick={exportarTransacoes}
              >
                <IconDownload className="size-3.5" />
                {transacoesSelecionadas.length > 0 ? "Exportar selecionadas" : "Exportar"}
              </Button>

              <Sheet open={aberto} onOpenChange={lidarMudancaAberturaFormulario}>
                <SheetTrigger asChild>
                  <Button size="lg">
                    <IconPlus />
                    Adicionar transacao
                  </Button>
                </SheetTrigger>
                <SheetContent className="flex h-full w-full flex-col overflow-hidden sm:max-w-xl">
                  <SheetHeader className="shrink-0">
                    <SheetTitle>Registrar transacao</SheetTitle>
                    <SheetDescription>
                      Adicione um novo lancamento financeiro rapidamente.
                    </SheetDescription>
                  </SheetHeader>
                  <form
                    className="flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-6"
                    onSubmit={handleSubmit(onSubmit)}
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Descricao</Label>
                      <Input {...register("descricao")} />
                      {errors.descricao ? (
                        <p className="text-xs text-destructive">
                          {errors.descricao.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tipo</Label>
                        <Controller
                          control={control}
                          name="tipo"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DESPESA">Despesa</SelectItem>
                                <SelectItem value="RECEITA">Receita</SelectItem>
                                <SelectItem value="TRANSFERENCIA">
                                  Transferencia
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.tipo ? (
                          <p className="text-xs text-destructive">{errors.tipo.message}</p>
                        ) : null}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Data</Label>
                        <Input type="date" {...register("dataLancamento")} />
                        {errors.dataLancamento ? (
                          <p className="text-xs text-destructive">
                            {errors.dataLancamento.message}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Categoria</Label>
                      <Controller
                        control={control}
                        name="categoriaId"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {categoriasFormulario.map((categoria) => (
                                <SelectItem key={categoria.id} value={categoria.id}>
                                  {categoria.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.categoriaId ? (
                        <p className="text-xs text-destructive">
                          {errors.categoriaId.message}
                        </p>
                      ) : null}
                    </div>

                    {/* ── Conta / Cartão ─────────────────────────────── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        {ehReceita ? "Conta de entrada" : "Conta ou cartão"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Controller
                        control={control}
                        name="contaId"
                        render={({ field }) => {
                          const contasNormais = contasDisponiveisFormulario.filter(
                            (c) => c.tipo !== "cartao_credito"
                          )
                          const cartoes = contasDisponiveisFormulario.filter(
                            (c) => c.tipo === "cartao_credito"
                          )

                          const rotulos: Record<string, string> = {
                            corrente: "Corrente",
                            poupanca: "Poupança",
                            investimento: "Investimento",
                            carteira: "Carteira",
                            cripto: "Cripto",
                          }

                          const contaSel = contas.find((c) => c.id === field.value)

                          return (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="h-auto min-h-10 w-full">
                                {contaSel ? (
                                  <div className="flex items-center gap-2.5 py-1">
                                    <LogoBanco
                                      instituicao={contaSel.instituicao}
                                      tamanho="sm"
                                    />
                                    <div className="min-w-0 text-left">
                                      <p className="text-sm font-medium leading-none">
                                        {contaSel.nome}
                                      </p>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {contaSel.tipo === "cartao_credito"
                                          ? `Limite ${formatarMoeda(contaSel.limiteCredito ?? contaSel.saldoAtual)}`
                                          : `Saldo ${formatarMoeda(contaSel.saldoAtual)}`}
                                        {contaSel.diaFechamento
                                          ? ` · Fecha dia ${contaSel.diaFechamento}`
                                          : ""}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <SelectValue
                                    placeholder={
                                      ehReceita
                                        ? "Selecione a conta que vai receber o valor"
                                        : "Selecione uma conta ou cartão"
                                    }
                                  />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {contasNormais.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                      Contas
                                    </SelectLabel>
                                    {contasNormais.map((conta) => (
                                      <SelectItem
                                        key={conta.id}
                                        value={conta.id}
                                        className="py-2"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <LogoBanco
                                            instituicao={conta.instituicao}
                                            tamanho="sm"
                                          />
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium leading-none">
                                              {conta.nome}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                              {rotulos[conta.tipo] ?? conta.tipo} ·{" "}
                                              {formatarMoeda(conta.saldoAtual)}
                                            </p>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}

                                {ehDespesa && cartoes.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                      Cartões de crédito
                                    </SelectLabel>
                                    {cartoes.map((conta) => (
                                      <SelectItem
                                        key={conta.id}
                                        value={conta.id}
                                        className="py-2"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <LogoBanco
                                            instituicao={conta.instituicao}
                                            tamanho="sm"
                                          />
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium leading-none">
                                              {conta.nome}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                              Limite {formatarMoeda(conta.limiteCredito ?? conta.saldoAtual)}
                                              {conta.diaFechamento
                                                ? ` · Fecha dia ${conta.diaFechamento}`
                                                : ""}
                                            </p>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}

                                {contas.length === 0 && (
                                  <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                    Nenhuma conta cadastrada.
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          )
                        }}
                      />
                      {errors.contaId ? (
                        <p className="text-xs text-destructive">{errors.contaId.message}</p>
                      ) : null}
                    </div>

                    {/* ── Valor ──────────────────────────────────────── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Valor em {moeda}</Label>
                      <Controller
                        control={control}
                        name="valor"
                        render={({ field }) => (
                          <CurrencyInput
                            placeholder={`${obterSimboloMoeda(moeda)} 0,00`}
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        )}
                      />
                      {errors.valor ? (
                        <p className="text-xs text-destructive">{errors.valor.message}</p>
                      ) : null}
                    </div>

                    {/* ── Meio de pagamento ──────────────────────────── */}
                    {ehDespesa && contaIdFormulario ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Meio de pagamento</Label>
                        <Controller
                          control={control}
                          name="meioPagamento"
                          render={({ field }) => (
                            <div className="flex flex-wrap gap-2">
                              {meiosPagamentoDisponiveis.map((opcao) => (
                                <button
                                  key={opcao.valor}
                                  type="button"
                                  onClick={() => field.onChange(opcao.valor)}
                                  className={cn(
                                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                                    field.value === opcao.valor
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border/70 bg-muted/20 text-foreground hover:bg-muted/50"
                                  )}
                                >
                                  {opcao.rotulo}
                                </button>
                              ))}
                            </div>
                          )}
                        />
                      </div>
                    ) : null}

                    {tipoFormulario !== "TRANSFERENCIA" ? (
                      <div className="space-y-4 rounded-md border border-border/70 bg-muted/10 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Status financeiro</Label>
                            <Controller
                              control={control}
                              name="statusPagamento"
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PENDENTE">
                                      {ehReceita ? "A receber" : "A pagar"}
                                    </SelectItem>
                                    <SelectItem value="AGENDADO">
                                      {ehReceita ? "Recebimento agendado" : "Pagamento agendado"}
                                    </SelectItem>
                                    <SelectItem value="PAGO">
                                      {ehReceita ? "Recebido" : "Pago"}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                              {ehReceita ? "Data prevista" : "Data de vencimento"}
                            </Label>
                            <Input type="date" {...register("dataVencimento")} />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                              {statusPagamentoFormulario === "PAGO"
                                ? ehReceita
                                  ? "Conta que recebeu"
                                  : "Conta que pagou"
                                : "Conta prevista para a baixa"}
                            </Label>
                            <Controller
                              control={control}
                              name="contaPagamentoId"
                              render={({ field }) => (
                                <Select
                                  value={field.value || "SEM_CONTA"}
                                  onValueChange={(valor) =>
                                    field.onChange(valor === "SEM_CONTA" ? "" : valor)
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
                              )}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                              {statusPagamentoFormulario === "PAGO"
                                ? ehReceita
                                  ? "Data do recebimento"
                                  : "Data do pagamento"
                                : "Data do agendamento"}
                            </Label>
                            <Input
                              type="date"
                              disabled={statusPagamentoFormulario === "PENDENTE"}
                              {...register(
                                statusPagamentoFormulario === "PAGO"
                                  ? "dataPagamento"
                                  : "dataAgendamentoPagamento"
                              )}
                            />
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          O saldo so muda quando o status estiver como pago/recebido. Em cartao de
                          credito, a despesa fica em aberto ate a quitacao da fatura.
                        </p>
                      </div>
                    ) : null}

                    {/* Banner de fatura para cartão de crédito */}
                    {faturaCalculada ? (
                      <div className="flex items-start gap-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                        <div className="mt-0.5 size-2 shrink-0 rounded-md bg-blue-500" />
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            Fatura de {faturaCalculada.descricao}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Compra fecha antes do dia {contaSelecionadaFormulario?.diaFechamento} →{" "}
                            entra nesta fatura. Após o fechamento → vai para a próxima.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3 border border-border/70 bg-muted/10 p-4">
                        <div>
                          <Label className="text-xs font-medium">
                            {ehReceita ? "Receita recorrente" : "Gasto recorrente"}
                          </Label>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {ehReceita
                              ? "Use para salário, aluguel recebido e outras entradas recorrentes nos filtros e relatórios."
                              : "Marque para identificar despesas fixas ou receitas recorrentes nos filtros e relatórios."}
                          </p>
                        </div>
                        <Controller
                          control={control}
                          name="recorrente"
                          render={({ field }) => (
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                            />
                          )}
                        />
                      </div>

                      {ehDespesa && recorrenteFormulario ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Dia fixo da cobranca</Label>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="Ex: 8"
                              {...register("diaRecorrenciaMensal")}
                            />
                            <p className="text-xs text-muted-foreground">
                              Use o dia do mes em que essa despesa costuma vencer ou ser cobrada.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {ehDespesa ? (
                        <div className="min-w-0 space-y-3 border border-border/70 bg-muted/10 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Label className="text-xs font-medium">Parcelar transacao</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Cria automaticamente as parcelas futuras para dar previsibilidade.
                            </p>
                          </div>
                          <Controller
                            control={control}
                            name="parcelada"
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value}
                                disabled={tipoFormulario !== "DESPESA"}
                                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              />
                            )}
                          />
                        </div>

                        {parcelada ? (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Quantidade de parcelas</Label>
                            <Input
                              type="number"
                              min="2"
                              max="360"
                              step="1"
                              placeholder="Ex.: 60"
                              {...register("quantidadeParcelas")}
                            />
                            <p className="text-xs text-muted-foreground">
                              Informe livremente a quantidade de parcelas, como 12, 36 ou 60.
                            </p>
                          </div>
                        ) : null}
                        </div>
                      ) : null}

                      {ehDespesa ? (
                        <div className="min-w-0 space-y-3 border border-border/70 bg-muted/10 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Label className="text-xs font-medium">Dividir com alguem</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Rateie por perfis do Kofre ou participantes externos.
                            </p>
                          </div>
                          <Controller
                            control={control}
                            name="dividirTransacao"
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              />
                            )}
                          />
                        </div>

                        {dividirTransacao ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">
                                Rateado: {formatarMoeda(totalDivididoFormulario)} de{" "}
                                {formatarMoeda(totalFormulario)}
                              </span>
                              <span
                                className={
                                  Math.abs(totalDivididoFormulario - totalFormulario) <= 0.009
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive"
                                }
                              >
                                Restante:{" "}
                                {formatarMoeda(
                                  arredondarMoeda(totalFormulario - totalDivididoFormulario)
                                )}
                              </span>
                            </div>

                            <div className="space-y-3 min-w-0">
                              {divisaoFields.map((field, indice) => {
                                const modoAtual =
                                  divisoesFormulario[indice]?.modo ?? field.modo ?? "externo"
                                const ehPerfilAtual = indice === 0

                                return (
                                  <div
                                    key={field.id}
                                    className="min-w-0 space-y-3 border border-border/70 bg-background p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-medium">
                                        {ehPerfilAtual
                                          ? "Sua parte"
                                          : `Participante ${indice + 1}`}
                                      </p>
                                      {ehPerfilAtual ? (
                                        <Badge variant="secondary">Perfil atual</Badge>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={() => remove(indice)}
                                        >
                                          <IconTrash className="size-3.5" />
                                        </Button>
                                      )}
                                    </div>

                                    {!ehPerfilAtual ? (
                                      <Controller
                                        control={control}
                                        name={`divisoes.${indice}.modo`}
                                        render={({ field: modoField }) => (
                                          <Select
                                            value={modoField.value}
                                            onValueChange={(valor) =>
                                              modoField.onChange(valor as "perfil" | "externo")
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="perfil">Perfil do Kofre</SelectItem>
                                              <SelectItem value="externo">Participante externo</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        )}
                                      />
                                    ) : null}

                                    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_96px_132px]">
                                      {ehPerfilAtual || modoAtual === "perfil" ? (
                                        <Controller
                                          control={control}
                                          name={`divisoes.${indice}.perfilId`}
                                          render={({ field: perfilField }) => (
                                            <Select
                                              value={
                                                ehPerfilAtual
                                                  ? perfilAtivo?.id ?? perfilField.value ?? ""
                                                  : perfilField.value ?? ""
                                              }
                                              onValueChange={perfilField.onChange}
                                              disabled={ehPerfilAtual}
                                            >
                                              <SelectTrigger className="min-w-0">
                                                <SelectValue placeholder="Selecione o perfil" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {(ehPerfilAtual
                                                  ? perfilAtivo
                                                    ? [perfilAtivo]
                                                    : []
                                                  : perfisRelacionados
                                                ).map((perfil) => (
                                                  <SelectItem key={perfil.id} value={perfil.id}>
                                                    {perfil.nome}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          )}
                                        />
                                      ) : (
                                        <Input
                                          className="min-w-0"
                                          placeholder="Nome do participante"
                                          {...register(`divisoes.${indice}.nome`)}
                                        />
                                      )}

                                      <Input
                                        className="min-w-0"
                                        type="number"
                                        step="0.01"
                                        placeholder="%"
                                        {...register(`divisoes.${indice}.percentual`, {
                                          onChange: (event) => {
                                            origemUltimaEdicaoDivisao.current[indice] = "percentual"
                                            const proximoValor = calcularValorPorPercentual(
                                              totalFormulario,
                                              event.target.value
                                            )
                                            setValue(`divisoes.${indice}.valor`, proximoValor, {
                                              shouldDirty: true,
                                            })
                                          },
                                        })}
                                      />

                                      <Controller
                                        control={control}
                                        name={`divisoes.${indice}.valor`}
                                        render={({ field: valorField }) => (
                                          <CurrencyInput
                                            className="min-w-0"
                                            placeholder={`${obterSimboloMoeda(moeda)} 0,00`}
                                            value={valorField.value}
                                            onValueChange={(valorFormatado) => {
                                              origemUltimaEdicaoDivisao.current[indice] = "valor"
                                              valorField.onChange(valorFormatado)
                                              const proximoPercentual = calcularPercentualPorValor(
                                                totalFormulario,
                                                valorFormatado
                                              )
                                              setValue(
                                                `divisoes.${indice}.percentual`,
                                                proximoPercentual,
                                                {
                                                  shouldDirty: true,
                                                }
                                              )
                                            }}
                                          />
                                        )}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => append(criarDivisaoExterna())}
                              >
                                <IconPlus className="size-3.5" />
                                Participante externo
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                disabled={perfisRelacionados.length === 0}
                                onClick={() =>
                                  append({
                                    modo: "perfil",
                                    perfilId: perfisRelacionados[0]?.id ?? "",
                                    nome: "",
                                    valor: "",
                                  })
                                }
                              >
                                <IconPlus className="size-3.5" />
                                Perfil do Kofre
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Observacao</Label>
                      <Textarea
                        className="min-h-24"
                        placeholder="Opcional"
                        {...register("observacao")}
                      />
                      {errors.observacao ? (
                        <p className="text-xs text-destructive">
                          {errors.observacao.message}
                        </p>
                      ) : null}
                    </div>

                    {erroFormularioAvancado ? (
                      <div className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                        {erroFormularioAvancado}
                      </div>
                    ) : null}

                    {contas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Crie uma conta primeiro na tela de contas para registrar
                        transacoes.
                      </p>
                    ) : null}

                    <Button className="w-full" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? "Salvando..." : "Salvar transacao"}
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {filtrosAbertos ? (
            <div className="grid gap-3 border border-border/70 bg-muted/15 p-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={filtroTipo} onValueChange={(valor) => setFiltroTipo(valor as FiltroTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="RECEITA">Receitas</SelectItem>
                    <SelectItem value="DESPESA">Despesas</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Conta</Label>
                <Select value={filtroContaId} onValueChange={setFiltroContaId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas</SelectItem>
                    {contas.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        <div className="flex items-center gap-2">
                          <LogoBanco instituicao={conta.instituicao} tamanho="sm" />
                          <span>{conta.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={filtroCategoriaId} onValueChange={setFiltroCategoriaId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas</SelectItem>
                    {categoriasDisponiveis.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Recorrencia</Label>
                <Select
                  value={filtroRecorrencia}
                  onValueChange={(valor) => setFiltroRecorrencia(valor as FiltroRecorrencia)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todas</SelectItem>
                    <SelectItem value="RECORRENTES">Recorrentes</SelectItem>
                    <SelectItem value="UNICA">Avulsas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pagamento</Label>
                <Select
                  value={filtroStatusPagamento}
                  onValueChange={(valor) => setFiltroStatusPagamento(valor as FiltroStatusPagamento)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDENTE">A pagar / receber</SelectItem>
                    <SelectItem value="AGENDADO">Agendados</SelectItem>
                    <SelectItem value="PAGO">Pagos / recebidos</SelectItem>
                    <SelectItem value="VENCIDOS">Vencidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Participante</Label>
                <Input
                  placeholder="Ex: Felipe"
                  value={filtroParticipante}
                  onChange={(event) => setFiltroParticipante(event.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button className="w-full" variant="outline" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 border-y border-border/70 py-4 md:grid-cols-5">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Transacoes
              </p>
              <p className="mt-2 text-3xl font-semibold">{totais.quantidade}</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Receitas
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatarMoeda(totais.receitas)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Minha Parte
              </p>
              <p className="mt-2 text-3xl font-semibold text-rose-600 dark:text-rose-400">
                {formatarMoeda(totais.despesasMinhaParte)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total Gasto
              </p>
              <p className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-400">
                {formatarMoeda(totais.despesasTotais)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Saldo
              </p>
              <p
                className={
                  totais.saldo >= 0
                    ? "mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400"
                    : "mt-2 text-3xl font-semibold text-rose-600 dark:text-rose-400"
                }
              >
                {formatarMoeda(totais.saldo)}
              </p>
            </div>
          </div>

          {selecionadas.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border border-border/70 bg-muted/15 px-3 py-2 text-sm">
              <span>
                {selecionadas.length} transacao(oes) selecionada(s).
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmacaoExclusaoEmLoteAberta(true)}
                >
                  <IconTrash className="size-3.5" />
                  Excluir {selecionadas.length} selecionada(s)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelecionadas([])}>
                  Limpar selecao
                </Button>
              </div>
            </div>
          ) : null}

          {transacoesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando transacoes...</p>
          ) : null}

          {transacoesQuery.isError ? (
            <p className="text-sm text-destructive">
              Nao foi possivel carregar as transacoes do backend.
            </p>
          ) : null}

          <div className="overflow-hidden border border-border/70">
            <div className="hidden grid-cols-[1.7fr_1fr_1fr_0.7fr_36px] items-center gap-4 border-b border-border/70 bg-muted/10 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground  lg:grid">
              <div>Descricao</div>
              <div>Conta</div>
              <div>Categoria</div>
              <div className="text-right">Valor</div>
              <label className="flex justify-end">
                <Checkbox
                  aria-label="Selecionar todas as transacoes da pagina"
                  checked={todasPaginadasSelecionadas}
                  onCheckedChange={() => alternarSelecionarTodas()}
                />
              </label>
            </div>

            {transacoesAgrupadas.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">Nenhuma transacao encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste a busca, os filtros ou navegue para outro mes.
                </p>
              </div>
            ) : (
              transacoesAgrupadas.map((grupo, indice) => (
                <div key={grupo.data}>
                  {indice > 0 ? <Separator /> : null}
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-base font-semibold">
                        {obterDataLocal(grupo.data).getDate()}{" "}
                        <span className="ml-2 text-sm font-normal text-muted-foreground capitalize">
                          {formatarDiaSemana(grupo.data)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatarData(grupo.data)}
                      </p>
                    </div>
                    <p
                      className={
                        grupo.total >= 0
                          ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                          : "text-sm font-semibold text-rose-600 dark:text-rose-400"
                      }
                    >
                      {formatarMoeda(grupo.total)}
                    </p>
                  </div>

                  {grupo.itens.map((item) => {
                    const conta = item.contaId ? contasPorId.get(item.contaId) : undefined
                    const categoria = categorias.find(
                      (categoriaItem) => categoriaItem.id === item.categoriaId
                    )

                    return (
                      <div
                        key={item.id}
                        className="grid gap-3 border-t border-border/70 px-4 py-4 transition-colors hover:bg-muted/60 hover:cursor-pointer lg:grid-cols-[1.7fr_1fr_1fr_0.7fr_36px] lg:items-center"
                        role="button"
                        tabIndex={0}
                        onClick={() => abrirTransacao(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            abrirTransacao(item.id)
                          }
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="border border-border/70 bg-muted/20 p-2 text-muted-foreground">
                              <IconCalendarMonth className="size-4" />
                            </div>
                            <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                                {item.descricao}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {item.recorrente ? (
                                  <Badge variant="secondary">Recorrente</Badge>
                                ) : null}
                                <Badge variant={obterVariantStatusPagamento(item)}>
                                  {obterRotuloStatusPagamento(item)}
                                </Badge>
                                {item.parcelada && item.parcelaNumero && item.parcelaTotal ? (
                                  <Badge variant="outline">
                                    {item.parcelaNumero}/{item.parcelaTotal}
                                  </Badge>
                                ) : null}
                                {item.compartilhada ? (
                                  <Badge variant="outline">Dividida</Badge>
                                ) : null}
                                {item.dataVencimento ? (
                                  <span>
                                    Vence em {formatarData(item.dataVencimento)}
                                  </span>
                                ) : null}
                                {item.statusPagamento === "PAGO" && item.dataPagamento ? (
                                  <span>
                                    Pago em {formatarData(item.dataPagamento)}
                                  </span>
                                ) : null}
                                {item.compartilhada ? (
                                  <span>
                                    Minha parte {formatarMoeda(item.valor)} de{" "}
                                    {formatarMoeda(obterValorIntegralLancamento(item))}
                                  </span>
                                ) : null}
                                <span>{item.tag}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <LogoBanco
                            instituicao={conta?.instituicao ?? item.contaInstituicao}
                            tamanho="sm"
                          />
                          <div>
                            <p className="text-sm font-medium">{item.conta}</p>
                            <p className="text-xs text-muted-foreground">
                              {obterRotuloConta(conta?.tipo ?? item.contaTipo)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div
                            className="border border-border/70 bg-muted/20 p-2 text-muted-foreground"
                            style={{
                              borderColor: categoria?.cor ? `${categoria.cor}55` : undefined,
                            }}
                          >
                            {secaoAtiva === "transferencias" ? (
                              <IconArrowsTransferUpDown className="size-4" />
                            ) : secaoAtiva === "investimentos" ? (
                              <IconPigMoney className="size-4" />
                            ) : (
                              <IconWallet className="size-4" />
                            )}
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {item.categoria}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.subcategoria}
                              </p>
                            </div>
                            <IconChevronRight className="size-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div
                          className={`text-left text-sm font-semibold lg:text-right ${obterCorValor(item.tipo)}`}
                        >
                          {item.tipo === "receita" ? "+" : item.tipo === "despesa" ? "-" : ""}
                          {formatarMoeda(item.valor)}
                        </div>

                        <label className="flex items-center justify-start lg:justify-end">
                          <Checkbox
                            aria-label={`Selecionar transacao ${item.descricao}`}
                            checked={selecionadas.includes(item.id)}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => alternarSelecao(item.id)}
                          />
                        </label>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {totalPaginas > 1 ? (
            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Pagina {paginaAtual} de {totalPaginas} &middot; {transacoesFiltradas.length} lancamentos
              </p>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={paginaAtual === 1}
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                >
                  <IconChevronLeft className="size-4" />
                  <span className="sr-only">Pagina anterior</span>
                </Button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 2)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (arr[idx - 1] ?? 0) < p - 1) {
                      acc.push("...")
                    }
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={item}
                        size="icon-sm"
                        variant={paginaAtual === item ? "secondary" : "outline"}
                        onClick={() => setPaginaAtual(item as number)}
                      >
                        {item}
                      </Button>
                    )
                  )}
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={paginaAtual === totalPaginas}
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                >
                  <IconChevronRight className="size-4" />
                  <span className="sr-only">Proxima pagina</span>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={confirmacaoExclusaoEmLoteAberta}
        onOpenChange={setConfirmacaoExclusaoEmLoteAberta}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir transacoes selecionadas</DialogTitle>
            <DialogDescription>
              Essa acao remove permanentemente as {selecionadas.length} transacao(oes) selecionadas e atualiza os saldos das contas envolvidas.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-semibold">Atencao: esta acao nao pode ser desfeita.</p>
            <p className="mt-1 text-xs text-destructive/80">
              {selecionadas.length} transacao(oes) sera(ao) excluida(s) permanentemente.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmacaoExclusaoEmLoteAberta(false)}
              disabled={excluirEmLoteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={excluirEmLoteMutation.isPending}
              onClick={() => void excluirEmLoteMutation.mutateAsync(selecionadas)}
            >
              <IconTrash className="size-4" />
              {excluirEmLoteMutation.isPending ? "Excluindo..." : `Excluir ${selecionadas.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
