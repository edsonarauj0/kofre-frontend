import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router-dom"
import { z } from "zod"
import {
  IconArrowDown,
  IconArrowRight,
  IconArrowUp,
  IconChevronRight,
  IconCopy,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconX,
  IconSearch,
  IconCornerDownLeft,
  IconPlus,
} from "@tabler/icons-react"

import { useAuth } from "@/app/auth"
import { usePerfilFinanceiro } from "@/app/perfil-financeiro"
import { listarContasApi } from "@/features/contas/api/contas-api"
import {
  atualizarTransacaoApi,
  excluirTransacaoApi,
  listarCategoriasApi,
  listarTransacoesApi,
} from "@/features/transacoes/api/transacoes-api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
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

type OpcaoMeio = { valor: string; rotulo: string }

function obterMeiosPagamentoPorContaTipo(tipoConta?: TipoConta): OpcaoMeio[] {
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

const rotulosMeioPagamento: Record<string, string> = {
  DEBITO: "Débito",
  CREDITO: "Crédito",
  BOLETO: "Boleto",
  PIX: "Pix",
}

function obterHojeIsoLocal() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, "0")
  const dia = String(agora.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

const schemaEdicao = z.object({
  descricao: z.string().min(3, "Informe uma descricao valida"),
  tipo: z.enum(["RECEITA", "DESPESA", "TRANSFERENCIA"]),
  valor: z
    .string()
    .min(1, "Informe um valor")
    .refine(
      (valor) => parseValorDigitado(valor) > 0,
      "Informe um valor maior que zero"
    ),
  dataLancamento: z.string().min(1, "Informe a data do lancamento"),
  categoriaId: z.string().min(1, "Selecione uma categoria"),
  contaId: z.string().min(1, "Selecione uma conta"),
  meioPagamento: z.string().optional(),
  recorrente: z.boolean(),
  statusPagamento: z.enum(["PENDENTE", "AGENDADO", "PAGO"]),
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

type FormularioEdicaoTransacao = z.infer<typeof schemaEdicao>
type DivisaoEdicao = FormularioEdicaoTransacao["divisoes"][number]

type TransacaoExplorerContextValue = {
  abrirTransacao: (transacaoId: string) => void
  transacoes: Transacao[]
}

const TransacaoExplorerContext =
  React.createContext<TransacaoExplorerContextValue | null>(null)

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

function obterDataPorExtenso(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(obterDataLocal(dataIso))
}

function statusEstaVencido(transacao: Transacao | null) {
  if (!transacao || transacao.statusPagamento === "PAGO" || !transacao.dataVencimento) {
    return false
  }
  return obterDataLocal(transacao.dataVencimento).getTime() < obterDataLocal(obterHojeIsoLocal()).getTime()
}

function obterRotuloStatusPagamento(transacao: Transacao | null) {
  if (!transacao) {
    return "Pago"
  }
  if (statusEstaVencido(transacao)) {
    return transacao.tipo === "receita" ? "A receber vencida" : "Vencida"
  }
  switch (transacao.statusPagamento) {
    case "AGENDADO":
      return transacao.tipo === "receita" ? "Recebimento agendado" : "Pagamento agendado"
    case "PENDENTE":
      return transacao.tipo === "receita" ? "A receber" : "A pagar"
    case "PAGO":
    default:
      return transacao.tipo === "receita" ? "Recebido" : "Pago"
  }
}

function obterVariantStatusPagamento(
  transacao: Transacao | null
): React.ComponentProps<typeof Badge>["variant"] {
  if (statusEstaVencido(transacao)) {
    return "destructive"
  }
  switch (transacao?.statusPagamento) {
    case "AGENDADO":
      return "warning"
    case "PENDENTE":
      return "outline"
    case "PAGO":
    default:
      return "success"
  }
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

function inferirTipoFormulario(transacao: Transacao) {
  switch (transacao.tipo) {
    case "receita":
      return "RECEITA" as const
    case "transferencia":
      return "TRANSFERENCIA" as const
    default:
      return "DESPESA" as const
  }
}

function corValorTransacao(transacao: Transacao | null) {
  if (!transacao) {
    return "text-foreground"
  }

  if (transacao.tipo === "receita") {
    return "text-emerald-600 dark:text-emerald-400"
  }

  if (transacao.tipo === "despesa") {
    return "text-rose-600 dark:text-rose-400"
  }

  return "text-foreground"
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

function criarDivisaoPerfilAtual(perfilId: string, nome: string): DivisaoEdicao {
  return {
    modo: "perfil",
    perfilId,
    nome,
    percentual: "",
    valor: "",
  }
}

function criarDivisaoExterna(): DivisaoEdicao {
  return {
    modo: "externo",
    perfilId: "",
    nome: "",
    percentual: "",
    valor: "",
  }
}

export function TransacaoExplorerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { moeda } = useAuth()
  const { perfilAtivo, perfis } = usePerfilFinanceiro()
  const queryClient = useQueryClient()
  const [transacaoAbertaId, setTransacaoAbertaId] = React.useState<string | null>(null)
  const [editorAberto, setEditorAberto] = React.useState(false)
  const [confirmacaoExclusaoAberta, setConfirmacaoExclusaoAberta] = React.useState(false)
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
    queryKey: ["transacoes", "explorer", contasQuery.data, categoriasQuery.data],
    queryFn: () =>
      listarTransacoesApi(categoriasQuery.data ?? [], contasQuery.data ?? []),
    enabled: Boolean(contasQuery.data && categoriasQuery.data),
  })

  const contas = contasQuery.data ?? []
  const categorias = categoriasQuery.data ?? []
  const transacoes = transacoesQuery.data ?? []

  const transacaoSelecionada = React.useMemo(
    () => transacoes.find((item) => item.id === transacaoAbertaId) ?? null,
    [transacaoAbertaId, transacoes]
  )

  const transacoesRelacionadasEdicao = React.useMemo(() => {
    if (!transacaoSelecionada) {
      return []
    }

    if (transacaoSelecionada.grupoParcelamentoId) {
      return transacoes
        .filter((item) => item.grupoParcelamentoId === transacaoSelecionada.grupoParcelamentoId)
        .sort((a, b) => obterDataLocal(a.data).getTime() - obterDataLocal(b.data).getTime())
    }

    if (transacaoSelecionada.grupoCompartilhamentoId) {
      return transacoes.filter(
        (item) => item.grupoCompartilhamentoId === transacaoSelecionada.grupoCompartilhamentoId
      )
    }

    return [transacaoSelecionada]
  }, [transacaoSelecionada, transacoes])

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormularioEdicaoTransacao>({
    resolver: zodResolver(schemaEdicao),
    defaultValues: {
      descricao: "",
      tipo: "DESPESA",
      valor: "",
      dataLancamento: "",
      categoriaId: "",
      contaId: "",
      recorrente: false,
      statusPagamento: "PAGO",
      dataVencimento: "",
      diaRecorrenciaMensal: "",
      dataAgendamentoPagamento: "",
      dataPagamento: "",
      contaPagamentoId: "",
      observacao: "",
      parcelada: false,
      quantidadeParcelas: "1",
      dividirTransacao: false,
      divisoes: [],
    },
  })
  const origemUltimaEdicaoDivisao = React.useRef<Record<number, "percentual" | "valor">>({})

  const { fields: divisaoFields, append, remove, replace } = useFieldArray({
    control,
    name: "divisoes",
  })

  React.useEffect(() => {
    if (!editorAberto || !transacaoSelecionada) {
      return
    }

    const primeiraData =
      transacoesRelacionadasEdicao[0]?.data ?? transacaoSelecionada.data
    const quantidadeParcelas =
      transacaoSelecionada.parcelaTotal ??
      (transacaoSelecionada.parcelada
        ? Math.max(transacoesRelacionadasEdicao.length, 1)
        : 1)

    const mapaDivisoes = new Map<
      string,
      {
        modo: "perfil" | "externo"
        perfilId?: string
        nome: string
        valor: number
        percentual?: number | null
      }
    >()

    transacoesRelacionadasEdicao.forEach((item) => {
      if (!item.divisoes?.length) {
        return
      }

      item.divisoes.forEach((divisao) => {
        const chave = divisao.perfilId ? `perfil:${divisao.perfilId}` : `externo:${divisao.nome}`
        const acumulado = mapaDivisoes.get(chave)
        mapaDivisoes.set(chave, {
          modo: divisao.perfilId ? "perfil" : "externo",
          perfilId: divisao.perfilId ?? undefined,
          nome: divisao.perfilNome ?? divisao.nome,
          percentual: divisao.percentual ?? acumulado?.percentual ?? null,
          valor: arredondarMoeda((acumulado?.valor ?? 0) + divisao.valor),
        })
      })
    })

    const divisoes = mapaDivisoes.size
      ? Array.from(mapaDivisoes.values()).map((divisao) => ({
          modo: divisao.modo,
          perfilId: divisao.perfilId,
          nome: divisao.nome,
          percentual: divisao.percentual != null ? String(divisao.percentual) : "",
          valor: String(divisao.valor),
        }))
      : []

    reset({
      descricao: transacaoSelecionada.descricao,
      tipo: inferirTipoFormulario(transacaoSelecionada),
      valor: String(transacaoSelecionada.valorOriginal ?? transacaoSelecionada.valor),
      dataLancamento: primeiraData,
      categoriaId: transacaoSelecionada.categoriaId ?? "",
      contaId: transacaoSelecionada.contaId ?? "",
      meioPagamento: transacaoSelecionada.meioPagamento ?? "",
      recorrente: Boolean(transacaoSelecionada.recorrente),
      statusPagamento: transacaoSelecionada.statusPagamento ?? "PAGO",
      dataVencimento: transacaoSelecionada.dataVencimento ?? "",
      diaRecorrenciaMensal: transacaoSelecionada.diaRecorrenciaMensal
        ? String(transacaoSelecionada.diaRecorrenciaMensal)
        : "",
      dataAgendamentoPagamento: transacaoSelecionada.dataAgendamentoPagamento ?? "",
      dataPagamento: transacaoSelecionada.dataPagamento ?? "",
      contaPagamentoId: transacaoSelecionada.contaPagamentoId ?? "",
      observacao: transacaoSelecionada.observacao ?? "",
      parcelada: Boolean(transacaoSelecionada.parcelada),
      quantidadeParcelas: String(quantidadeParcelas),
      dividirTransacao: Boolean(transacaoSelecionada.compartilhada),
      divisoes,
    })
    setErroFormularioAvancado(null)
  }, [editorAberto, transacaoSelecionada, transacoesRelacionadasEdicao, reset])

  const tipoEditado = watch("tipo")
  const parcelada = watch("parcelada")
  const dividirTransacao = watch("dividirTransacao")
  const valorEditado = watch("valor")
  const divisoesFormulario = watch("divisoes")
  const statusPagamentoEditado = watch("statusPagamento")
  const contaIdEditado = watch("contaId")
  const contaPagamentoIdEditado = watch("contaPagamentoId")
  const dataLancamentoEditado = watch("dataLancamento")
  const recorrenteEditado = watch("recorrente")
  const diaRecorrenciaMensalEditado = watch("diaRecorrenciaMensal")
  const ehDespesa = tipoEditado === "DESPESA"
  const ehReceita = tipoEditado === "RECEITA"

  const contaEditadaObj = React.useMemo(
    () => contas.find((c) => c.id === contaIdEditado),
    [contas, contaIdEditado]
  )

  const contasDisponiveisEdicao = React.useMemo(() => {
    if (ehDespesa) {
      return contas
    }

    return contas.filter((conta) => conta.tipo !== "cartao_credito")
  }, [contas, ehDespesa])

  const meiosPagamentoEdicao = React.useMemo(
    () => (ehDespesa ? obterMeiosPagamentoPorContaTipo(contaEditadaObj?.tipo) : []),
    [contaEditadaObj, ehDespesa]
  )

  const contasPagamentoDisponiveis = React.useMemo(
    () => contas.filter((conta) => conta.tipo !== "cartao_credito"),
    [contas]
  )

  const categoriasFiltradas = React.useMemo(() => {
    return categorias.filter((categoria) => {
      if (tipoEditado === "TRANSFERENCIA") {
        return categoria.tipo === "TRANSFERENCIA"
      }

      return categoria.tipo === tipoEditado
    })
  }, [categorias, tipoEditado])

  const perfisRelacionados = React.useMemo(
    () => perfis.filter((perfil) => perfil.id !== perfilAtivo?.id),
    [perfilAtivo?.id, perfis]
  )

  const totalEditado = React.useMemo(() => {
    const valor = parseNumeroMoeda(valorEditado ?? "")
    return Number.isFinite(valor) ? valor : 0
  }, [valorEditado])

  const totalDividido = React.useMemo(
    () =>
      divisoesFormulario.reduce((total, divisao) => {
        const valor = parseNumeroMoeda(divisao.valor ?? "")
        return Number.isFinite(valor) ? total + valor : total
      }, 0),
    [divisoesFormulario]
  )

  React.useEffect(() => {
    if (!dividirTransacao || totalEditado <= 0) {
      return
    }

    divisoesFormulario.forEach((divisao, indice) => {
      const origem = origemUltimaEdicaoDivisao.current[indice]
      if (origem === "percentual") {
        const valorCalculado = calcularValorPorPercentual(totalEditado, divisao.percentual)
        if ((divisao.valor ?? "") !== valorCalculado) {
          setValue(`divisoes.${indice}.valor`, valorCalculado, { shouldDirty: true })
        }
      }

      if (origem === "valor") {
        const percentualCalculado = calcularPercentualPorValor(totalEditado, divisao.valor)
        if ((divisao.percentual ?? "") !== percentualCalculado) {
          setValue(`divisoes.${indice}.percentual`, percentualCalculado, { shouldDirty: true })
        }
      }
    })
  }, [dividirTransacao, divisoesFormulario, setValue, totalEditado])

  React.useEffect(() => {
    const categoriaAtual = getValues("categoriaId")
    if (!categoriaAtual) {
      return
    }

    const categoriaSelecionada = categorias.find((categoria) => categoria.id === categoriaAtual)
    if (!categoriaSelecionada || categoriaSelecionada.tipo !== tipoEditado) {
      setValue("categoriaId", "")
    }
  }, [categorias, getValues, setValue, tipoEditado])

  React.useEffect(() => {
    if (!ehDespesa || !recorrenteEditado) {
      if (diaRecorrenciaMensalEditado) {
        setValue("diaRecorrenciaMensal", "")
      }
      return
    }

    if (diaRecorrenciaMensalEditado && dataLancamentoEditado && !getValues("dataVencimento")) {
      setValue(
        "dataVencimento",
        ajustarDataParaDiaDoMes(dataLancamentoEditado, diaRecorrenciaMensalEditado)
      )
    }
  }, [
    dataLancamentoEditado,
    diaRecorrenciaMensalEditado,
    ehDespesa,
    getValues,
    recorrenteEditado,
    setValue,
  ])

  React.useEffect(() => {
    if (tipoEditado !== "DESPESA" && parcelada) {
      setValue("parcelada", false)
      setValue("quantidadeParcelas", "1")
    }

    if (tipoEditado !== "DESPESA" && dividirTransacao) {
      setValue("dividirTransacao", false)
    }

    if (tipoEditado !== "DESPESA" && contaEditadaObj?.tipo === "cartao_credito") {
      setValue("contaId", "")
    }

    if (tipoEditado !== "DESPESA") {
      setValue("meioPagamento", "")
    } else {
      const primeiroMeio = obterMeiosPagamentoPorContaTipo(contaEditadaObj?.tipo)[0]?.valor ?? ""
      setValue("meioPagamento", primeiroMeio)
    }
  }, [contaEditadaObj?.tipo, dividirTransacao, parcelada, setValue, tipoEditado])

  React.useEffect(() => {
    if (tipoEditado === "TRANSFERENCIA") {
      setValue("statusPagamento", "PAGO")
      setValue("dataVencimento", "")
      setValue("dataAgendamentoPagamento", "")
      setValue("dataPagamento", dataLancamentoEditado || obterHojeIsoLocal())
      setValue("contaPagamentoId", "")
      return
    }

    if (statusPagamentoEditado === "PAGO" && !getValues("dataPagamento")) {
      setValue("dataPagamento", dataLancamentoEditado || obterHojeIsoLocal())
    }

    if (statusPagamentoEditado === "AGENDADO" && !getValues("dataAgendamentoPagamento")) {
      setValue(
        "dataAgendamentoPagamento",
        getValues("dataVencimento") || dataLancamentoEditado || obterHojeIsoLocal()
      )
    }

    if (statusPagamentoEditado !== "PAGO") {
      setValue("dataPagamento", "")
    }

    if (statusPagamentoEditado !== "AGENDADO") {
      setValue("dataAgendamentoPagamento", "")
    }

    if (
      contaEditadaObj?.tipo === "cartao_credito" &&
      statusPagamentoEditado === "PAGO" &&
      !contaPagamentoIdEditado
    ) {
      const contaSugestao = contasPagamentoDisponiveis[0]
      if (contaSugestao) {
        setValue("contaPagamentoId", contaSugestao.id)
      }
    }
  }, [
    contaEditadaObj?.tipo,
    contaPagamentoIdEditado,
    contasPagamentoDisponiveis,
    dataLancamentoEditado,
    getValues,
    setValue,
    statusPagamentoEditado,
    tipoEditado,
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

  const atualizarMutation = useMutation({
    mutationFn: async (valores: FormularioEdicaoTransacao) => {
      if (!transacaoSelecionada) {
        throw new Error("Transacao nao encontrada")
      }

      const valorTotal = arredondarMoeda(parseNumeroMoeda(valores.valor))
      const quantidadeParcelas = valores.parcelada
        ? Math.max(1, Number(valores.quantidadeParcelas || "1"))
        : 1

      if (
        valores.tipo === "DESPESA" &&
        contaEditadaObj?.tipo === "cartao_credito" &&
        valores.statusPagamento === "PAGO" &&
        !valores.contaPagamentoId
      ) {
        throw new Error("Selecione a conta que quitou a fatura para marcar a despesa como paga.")
      }

      let divisoesPayload:
        | Array<{
            nome?: string
            valor?: number
            percentual?: number
            perfilId?: string
          }>
        | null = null

      if (valores.dividirTransacao) {
        if (!perfilAtivo) {
          throw new Error("Nenhum perfil ativo encontrado para dividir a transacao.")
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
            throw new Error("Quando usar percentual, informe um percentual maior que zero para todos os participantes.")
          }

          const somaPercentuais = percentuaisNormalizados.reduce((total, percentual) => total + percentual, 0)
          if (Math.abs(somaPercentuais - 100) > 0.01) {
            throw new Error("A soma dos percentuais precisa ser igual a 100%.")
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
          throw new Error("Adicione ao menos a sua parte e mais um participante.")
        }

        const perfisUsados = new Set<string>()
        for (const divisao of divisoesNormalizadas) {
          if (divisao.valor <= 0) {
            throw new Error("Cada participante da divisao precisa ter um valor maior que zero.")
          }
          if (divisao.modo === "perfil" && !divisao.perfilId) {
            throw new Error("Selecione o perfil para cada participante interno.")
          }
          if (divisao.perfilId) {
            if (perfisUsados.has(divisao.perfilId)) {
              throw new Error("Nao repita o mesmo perfil na divisao da transacao.")
            }
            perfisUsados.add(divisao.perfilId)
          }
          if (divisao.modo === "externo" && !divisao.nome) {
            throw new Error("Informe o nome de cada participante externo.")
          }
        }

        const totalDividido = arredondarMoeda(
          divisoesNormalizadas.reduce((total, divisao) => total + divisao.valor, 0)
        )

        if (Math.abs(totalDividido - valorTotal) > 0.009) {
          throw new Error("A soma das divisoes precisa ser igual ao valor total da transacao.")
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
        throw new Error("Informe um dia fixo da cobranca entre 1 e 31.")
      }

      return atualizarTransacaoApi(transacaoSelecionada.id, {
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
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transacoes"] })
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      setErroFormularioAvancado(null)
      setEditorAberto(false)
    },
    onError: (error) => {
      setErroFormularioAvancado(error instanceof Error ? error.message : "Nao foi possivel salvar a transacao.")
    },
  })

  const excluirMutation = useMutation({
    mutationFn: async () => {
      if (!transacaoSelecionada) {
        throw new Error("Transacao nao encontrada")
      }

      await excluirTransacaoApi(transacaoSelecionada.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transacoes"] })
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      setConfirmacaoExclusaoAberta(false)
      fecharPainel()
    },
  })

  const abrirTransacao = React.useCallback((transacaoId: string) => {
    setEditorAberto(false)
    setConfirmacaoExclusaoAberta(false)
    setTransacaoAbertaId(transacaoId)
  }, [])

  const fecharPainel = React.useCallback(() => {
    setConfirmacaoExclusaoAberta(false)
    setEditorAberto(false)
    setTransacaoAbertaId(null)
  }, [])

  const contaSelecionada = transacaoSelecionada?.contaId
    ? contas.find((item) => item.id === transacaoSelecionada.contaId)
    : undefined
  const categoriaSelecionada = transacaoSelecionada?.categoriaId
    ? categorias.find((item) => item.id === transacaoSelecionada.categoriaId)
    : undefined

  const copiarIdTransacao = React.useCallback(async () => {
    if (!transacaoSelecionada || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(transacaoSelecionada.id)
  }, [transacaoSelecionada])

  const abrirModoEdicao = React.useCallback(() => {
    if (!transacaoSelecionada) {
      return
    }

    setErroFormularioAvancado(null)
    setEditorAberto(true)
  }, [transacaoSelecionada])

  const cancelarModoEdicao = React.useCallback(() => {
    setErroFormularioAvancado(null)
    setEditorAberto(false)
  }, [])

  return (
    <TransacaoExplorerContext.Provider value={{ abrirTransacao, transacoes }}>
      {children}

      <Sheet
        open={Boolean(transacaoSelecionada)}
        onOpenChange={(aberto) => {
          if (!aberto) {
            fecharPainel()
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg" showCloseButton={false}>
          {transacaoSelecionada ? (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>Transacao</SheetTitle>
                <SheetDescription>{obterDataPorExtenso(transacaoSelecionada.data)}</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-start border-b border-border/70 px-4 py-4">
                <Button
                  variant="ghost"
                  className="justify-self-start hover:cursor-pointer"
                  size="icon-sm"
                  onClick={fecharPainel}
                >
                  <IconX className="size-4 text-muted-foreground" />
                  <span className="sr-only">Fechar transacao</span>
                </Button>
                <div className="space-y-1 px-3 text-center">
                  <p className="text-[11px] font-semibold  tracking-[0.18em] text-muted-foreground">
                    {editorAberto ? "Editando transação" : "Transação"}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {obterDataPorExtenso(transacaoSelecionada.data)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="justify-self-end hover:cursor-pointer"
                      size="icon-sm"
                    >
                      <IconDotsVertical className="size-4 text-muted-foreground" />
                      <span className="sr-only">Mais acoes da transacao</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 min-w-56">
                    <DropdownMenuItem onClick={editorAberto ? cancelarModoEdicao : abrirModoEdicao}>
                      <IconEdit />
                      {editorAberto ? "Sair do modo edicao" : "Modo edicao"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void copiarIdTransacao()}>
                      <IconCopy />
                      Copiar ID
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setConfirmacaoExclusaoAberta(true)}
                    >
                      <IconTrash />
                      Excluir transação
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {editorAberto ? (
                <form
                  className="flex min-h-0 flex-1 flex-col"
                  onSubmit={handleSubmit(async (valores) => {
                    await atualizarMutation.mutateAsync(valores)
                  })}
                >
                  <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Descricao</Label>
                        <Input {...register("descricao")} />
                        {errors.descricao ? (
                          <p className="text-xs text-destructive">{errors.descricao.message}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Valor em {moeda}</Label>
                        <Controller
                          control={control}
                          name="valor"
                          render={({ field }) => (
                            <CurrencyInput
                              className="min-w-32"
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
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tipo</Label>
                        <Controller
                          control={control}
                          name="tipo"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DESPESA">Despesa</SelectItem>
                                <SelectItem value="RECEITA">Receita</SelectItem>
                                <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
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

                    {/* ── Conta / Cartão ──────────────────────────────────── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        {ehReceita ? "Conta de entrada" : "Conta ou cartão"}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Controller
                        control={control}
                        name="contaId"
                        render={({ field }) => {
                          const contasNormais = contasDisponiveisEdicao.filter(
                            (c) => c.tipo !== "cartao_credito"
                          )
                          const cartoes = contasDisponiveisEdicao.filter(
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

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Categoria</Label>
                      <Controller
                        control={control}
                        name="categoriaId"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {categoriasFiltradas.map((categoria) => (
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

                    {/* Meio de pagamento na edição */}
                    {ehDespesa && contaIdEditado ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Meio de pagamento</Label>
                        <Controller
                          control={control}
                          name="meioPagamento"
                          render={({ field }) => (
                            <div className="flex flex-wrap gap-2">
                              {meiosPagamentoEdicao.map((opcao) => (
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

                    {tipoEditado !== "TRANSFERENCIA" ? (
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
                              {statusPagamentoEditado === "PAGO"
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
                              {statusPagamentoEditado === "PAGO"
                                ? ehReceita
                                  ? "Data do recebimento"
                                  : "Data do pagamento"
                                : "Data do agendamento"}
                            </Label>
                            <Input
                              type="date"
                              disabled={statusPagamentoEditado === "PENDENTE"}
                              {...register(
                                statusPagamentoEditado === "PAGO"
                                  ? "dataPagamento"
                                  : "dataAgendamentoPagamento"
                              )}
                            />
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          O saldo so e atualizado na conta correspondente quando a transacao fica
                          como paga/recebida.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nota</Label>
                      <Textarea
                        className="min-h-24"
                        placeholder="Adicione um contexto util para esta transacao"
                        {...register("observacao")}
                      />
                      {errors.observacao ? (
                        <p className="text-xs text-destructive">{errors.observacao.message}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-4">
                      {ehDespesa ? (
                        <div className="min-w-0 space-y-3 border border-border/70 bg-muted/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Label className="text-xs font-medium">Parcelar transacao</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Atualize a quantidade de parcelas futuras desta transacao.
                            </p>
                          </div>
                          <Controller
                            control={control}
                            name="parcelada"
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value}
                                disabled={tipoEditado !== "DESPESA"}
                                onCheckedChange={(checked: boolean | "indeterminate") =>
                                  field.onChange(Boolean(checked))
                                }
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
                          </div>
                        ) : null}
                        </div>
                      ) : null}

                      <div className="min-w-0 space-y-3 border border-border/70 bg-muted/10 p-4">
                        <div className="flex items-start justify-between gap-3 rounded-md border border-border/70 bg-background p-3">
                          <div className="min-w-0">
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
                                onCheckedChange={(checked: boolean | "indeterminate") =>
                                  field.onChange(Boolean(checked))
                                }
                              />
                            )}
                          />
                        </div>

                        {ehDespesa && recorrenteEditado ? (
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
                                Define o dia do mes em que essa despesa costuma vencer.
                              </p>
                            </div>
                          </div>
                        ) : null}

                        {ehDespesa ? (
                          <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Label className="text-xs font-medium">Dividir com alguem</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Rateie com perfis do Kofre ou participantes externos.
                            </p>
                          </div>
                          <Controller
                            control={control}
                            name="dividirTransacao"
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked: boolean | "indeterminate") =>
                                  field.onChange(Boolean(checked))
                                }
                              />
                            )}
                          />
                          </div>
                        ) : null}

                        {ehDespesa && dividirTransacao ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">
                                Rateado: {formatarMoeda(totalDividido)} de {formatarMoeda(totalEditado)}
                              </span>
                              <span
                                className={
                                  Math.abs(totalDividido - totalEditado) <= 0.009
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive"
                                }
                              >
                                Restante: {formatarMoeda(arredondarMoeda(totalEditado - totalDividido))}
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
                                        {ehPerfilAtual ? "Sua parte" : `Participante ${indice + 1}`}
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

                                    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_108px_132px]">
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
                                              totalEditado,
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
                                                totalEditado,
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
                                    percentual: "",
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
                    </div>

                    {erroFormularioAvancado ? (
                      <div className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                        {erroFormularioAvancado}
                      </div>
                    ) : null}
                  </div>

                  <SheetFooter className="border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur-sm">
                    <div className="flex w-full items-center justify-end gap-2">
                      <Button type="button" variant="outline" onClick={cancelarModoEdicao}>
                        Cancelar
                      </Button>
                      <Button disabled={isSubmitting || atualizarMutation.isPending} type="submit">
                        {isSubmitting || atualizarMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </SheetFooter>
                </form>
              ) : (
                <div className="flex-1 space-y-6 overflow-y-auto p-6">
                  <div className="space-y-3 text-center">
                    <p className="text-3xl font-semibold leading-tight">
                      {transacaoSelecionada.descricao}
                    </p>
                    <p
                      className={cn("text-4xl font-semibold", corValorTransacao(transacaoSelecionada))}
                    >
                      {formatarMoeda(transacaoSelecionada.valor)}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Badge variant={obterVariantStatusPagamento(transacaoSelecionada)}>
                        {obterRotuloStatusPagamento(transacaoSelecionada)}
                      </Badge>
                      {transacaoSelecionada.parcelada &&
                      transacaoSelecionada.parcelaNumero &&
                      transacaoSelecionada.parcelaTotal ? (
                        <Badge variant="outline">
                          Parcela {transacaoSelecionada.parcelaNumero}/
                          {transacaoSelecionada.parcelaTotal}
                        </Badge>
                      ) : null}
                      {transacaoSelecionada.compartilhada ? (
                        <Badge variant="outline">Dividida</Badge>
                      ) : null}
                      {transacaoSelecionada.recorrente ? (
                        <Badge variant="secondary">Recorrente</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-border/70 p-4">
                    <p className="text-muted-foreground">
                      Categoria
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{transacaoSelecionada.categoria}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {transacaoSelecionada.subcategoria}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-md border border-border/70 p-4">
                      <p className="text-muted-foreground">
                        Conta
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <LogoBanco
                          instituicao={contaSelecionada?.instituicao ?? transacaoSelecionada.contaInstituicao}
                        />
                        <div>
                          <p className="text-sm font-medium">{transacaoSelecionada.conta}</p>
                          <p className="text-xs text-muted-foreground">
                            {obterRotuloConta(contaSelecionada?.tipo ?? transacaoSelecionada.contaTipo)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-muted-foreground">
                          Data
                        </p>
                        <p className="mt-2 font-medium">
                          {formatarData(transacaoSelecionada.data)}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-muted-foreground">
                          Tipo
                        </p>
                        <p className="mt-2 font-medium capitalize">
                          {transacaoSelecionada.tipo}
                        </p>
                      </div>
                    </div>

                    {(transacaoSelecionada.dataVencimento ||
                      transacaoSelecionada.dataAgendamentoPagamento ||
                      transacaoSelecionada.dataPagamento ||
                      transacaoSelecionada.contaPagamentoId) ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {transacaoSelecionada.dataVencimento ? (
                          <div className="rounded-md border border-border/70 p-4">
                            <p className="text-muted-foreground">Vencimento</p>
                            <p className="mt-2 font-medium">
                              {formatarData(transacaoSelecionada.dataVencimento)}
                            </p>
                          </div>
                        ) : null}

                        {transacaoSelecionada.dataAgendamentoPagamento ? (
                          <div className="rounded-md border border-border/70 p-4">
                            <p className="text-muted-foreground">Agendamento</p>
                            <p className="mt-2 font-medium">
                              {formatarData(transacaoSelecionada.dataAgendamentoPagamento)}
                            </p>
                          </div>
                        ) : null}

                        {transacaoSelecionada.dataPagamento ? (
                          <div className="rounded-md border border-border/70 p-4">
                            <p className="text-muted-foreground">
                              {transacaoSelecionada.tipo === "receita"
                                ? "Recebido em"
                                : "Pago em"}
                            </p>
                            <p className="mt-2 font-medium">
                              {formatarData(transacaoSelecionada.dataPagamento)}
                            </p>
                          </div>
                        ) : null}

                        {transacaoSelecionada.contaPagamentoId ? (
                          <div className="rounded-md border border-border/70 p-4">
                            <p className="text-muted-foreground">
                              {transacaoSelecionada.tipo === "receita"
                                ? "Conta de recebimento"
                                : "Conta de pagamento"}
                            </p>
                            <p className="mt-2 font-medium">
                              {contas.find(
                                (conta) => conta.id === transacaoSelecionada.contaPagamentoId
                              )?.nome ?? "Conta vinculada"}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {transacaoSelecionada.meioPagamento ? (
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-muted-foreground">Meio de pagamento</p>
                        <p className="mt-2 font-medium">
                          {rotulosMeioPagamento[transacaoSelecionada.meioPagamento] ?? transacaoSelecionada.meioPagamento}
                        </p>
                      </div>
                    ) : null}

                    {(transacaoSelecionada.valorOriginal &&
                      transacaoSelecionada.valorOriginal !== transacaoSelecionada.valor) ||
                    transacaoSelecionada.grupoParcelamentoId ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border border-border/70 p-4">
                          <p className="text-muted-foreground">Valor original</p>
                          <p className="mt-2 font-medium">
                            {formatarMoeda(
                              transacaoSelecionada.valorOriginal ?? transacaoSelecionada.valor
                            )}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/70 p-4">
                          <p className="text-muted-foreground">Parcelamento</p>
                          <p className="mt-2 font-medium">
                            {transacaoSelecionada.parcelada &&
                            transacaoSelecionada.parcelaNumero &&
                            transacaoSelecionada.parcelaTotal
                              ? `${transacaoSelecionada.parcelaNumero}/${transacaoSelecionada.parcelaTotal}`
                              : "Lancamento unico"}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {transacaoSelecionada.compartilhada && transacaoSelecionada.divisoes?.length ? (
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-muted-foreground">Divisao da transacao</p>
                        <div className="mt-3 space-y-2">
                          {transacaoSelecionada.divisoes.map((divisao) => (
                            <div
                              key={divisao.id}
                              className="flex items-center justify-between gap-3 border border-border/60 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {divisao.perfilNome ?? divisao.nome}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {divisao.perfilId ? "Perfil do Kofre" : "Participante externo"}
                                  {divisao.percentual != null ? ` · ${divisao.percentual}%` : ""}
                                </p>
                              </div>
                              <span className="text-sm font-semibold">
                                {formatarMoeda(divisao.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-md border border-border/70 p-4">
                      <p className="text-muted-foreground">
                        Nota
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {transacaoSelecionada.observacao?.trim()
                          ? transacaoSelecionada.observacao
                          : "Nenhuma nota adicionada para esta transacao."}
                      </p>
                    </div>

                    {categoriaSelecionada?.grupo ? (
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-muted-foreground">
                          Grupo da categoria
                        </p>
                        <p className="mt-2 font-medium">
                          {categoriaSelecionada.grupo}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmacaoExclusaoAberta} onOpenChange={setConfirmacaoExclusaoAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir transacao</DialogTitle>
            <DialogDescription>
              Essa acao remove a transacao selecionada e atualiza o saldo da conta.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="font-medium">{transacaoSelecionada?.descricao}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {transacaoSelecionada ? formatarMoeda(transacaoSelecionada.valor) : ""}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmacaoExclusaoAberta(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={excluirMutation.isPending}
              onClick={() => void excluirMutation.mutateAsync()}
            >
              {excluirMutation.isPending ? "Excluindo..." : "Excluir transacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TransacaoExplorerContext.Provider>
  )
}

export function useTransacaoExplorer() {
  const context = React.useContext(TransacaoExplorerContext)

  if (!context) {
    throw new Error("useTransacaoExplorer precisa ser usado dentro do provider")
  }

  return context
}

export function BuscaGlobalTransacoes() {
  const navigate = useNavigate()
  const { abrirTransacao, transacoes } = useTransacaoExplorer()
  const [termo, setTermo] = React.useState("")
  const [aberta, setAberta] = React.useState(false)
  const [indiceAtivo, setIndiceAtivo] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    function lidarAtalho(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setAberta(true)
      }
    }

    window.addEventListener("keydown", lidarAtalho)
    return () => window.removeEventListener("keydown", lidarAtalho)
  }, [])

  const resultados = React.useMemo(() => {
    const consulta = termo.trim().toLowerCase()
    if (consulta.length < 2) {
      return []
    }

    return transacoes
      .filter((item) =>
        [
          item.descricao,
          item.categoria,
          item.subcategoria,
          item.conta,
          item.observacao ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(consulta)
      )
      .slice(0, 8)
  }, [termo, transacoes])

  React.useEffect(() => {
    if (!aberta) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [aberta])

  React.useEffect(() => {
    setIndiceAtivo(0)
  }, [termo])

  const abrirResultado = (transacaoId: string) => {
    abrirTransacao(transacaoId)
    setTermo("")
    setAberta(false)
    setIndiceAtivo(0)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start gap-3 border border-sidebar-border/80 bg-sidebar-accent/30 px-3 py-2 text-left font-normal hover:cursor-pointer hover:bg-sidebar-accent/60 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
        onClick={() => setAberta(true)}
      >
        <IconSearch className="size-3 shrink-0 text-sidebar-foreground/70" />
        <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
          Buscar...
        </span>
        <span className="border border-sidebar-border/80 bg-sidebar px-2 py-0.5 text-[0.565rem] text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden rounded-md">
          Ctrl+K
        </span>
      </Button>

      <Dialog
        open={aberta}
        onOpenChange={(open) => {
          setAberta(open)
          if (!open) {
            setTermo("")
            setIndiceAtivo(0)
          }
        }}
      >
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Buscar transacoes</DialogTitle>
            <DialogDescription>
              Busque transacoes por descricao, categoria, conta ou nota.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-border/70 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="border border-border/70 bg-muted/30 p-2 text-muted-foreground rounded-md">
                <IconSearch className="size-5" />
              </div>
              <Input
                ref={inputRef}
                className="h-auto border-0 bg-transparent px-0 text-lg shadow-none focus-visible:ring-0"
                placeholder="Buscar transações..."
                value={termo}
                onChange={(event) => setTermo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setIndiceAtivo((atual) =>
                      Math.min(resultados.length - 1, atual + 1)
                    )
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setIndiceAtivo((atual) => Math.max(0, atual - 1))
                  }

                  if (event.key === "Enter" && resultados[indiceAtivo]) {
                    event.preventDefault()
                    abrirResultado(resultados[indiceAtivo].id)
                  }
                }}
              />
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="px-2 text-muted-foreground"
                onClick={() => setAberta(false)}
              >
                esc
              </Button>
            </div>
          </div>

          <div className="min-h-80 max-h-[50vh] overflow-y-auto">
            {termo.trim().length < 2 ? (
              <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                <div className="border border-border/70 bg-muted/20 p-4 text-muted-foreground">
                  <IconSearch className="size-7" />
                </div>
                <p className="mt-6 text-2xl font-medium">Busque por transacoes</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Digite para encontrar por descricao, categoria, conta ou nota.
                </p>
              </div>
            ) : resultados.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                <div className="border border-border/70 bg-muted/20 p-4 text-muted-foreground">
                  <IconSearch className="size-7" />
                </div>
                <p className="mt-6 text-xl font-medium">Nenhuma transacao encontrada</p>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Tente outro termo ou abra a tela completa de transacoes para refinar.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {resultados.map((transacao, indice) => (
                  <Button
                    key={transacao.id}
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-auto w-full justify-between gap-4 px-4 py-3 text-left font-normal transition-colors hover:bg-muted/50 hover:cursor-pointer",
                      indice === indiceAtivo && "bg-muted/30"
                    )}
                    onMouseEnter={() => setIndiceAtivo(indice)}
                    onClick={() => abrirResultado(transacao.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <LogoBanco instituicao={transacao.contaInstituicao} tamanho="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{transacao.descricao}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {transacao.categoria} • {transacao.conta} • {formatarData(transacao.data)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">
                        {formatarMoeda(transacao.valor)}
                      </span>
                      <IconChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="border border-border/70 bg-muted/20 px-1.5 py-0.5 rounded-md">
                  <IconArrowUp className="size-3" />
                </span>
                <span className="border border-border/70 bg-muted/20 px-1.5 py-0.5 rounded-md">
                  <IconArrowDown className="size-3" />
                </span>
                navegar
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="border border-border/70 bg-muted/20 px-1.5 py-0.5 rounded-md">
                  <IconCornerDownLeft className="size-3" />
                </span>
                selecionar
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-0 text-muted-foreground/70 hover:text-primary hover:bg-transparent hover:cursor-pointer"
              onClick={() => {
                setAberta(false)
                navigate("/transacoes")
              }}
            >
              Ver todas as transacoes
              <IconArrowRight className="size-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
