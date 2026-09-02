import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  IconAlertTriangle,
  IconBrain,
  IconCheck,
  IconCreditCard,
  IconFileAnalytics,
  IconHistory,
  IconLoader2,
  IconReceipt2,
  IconRobot,
  IconSparkles,
  IconTool,
} from "@tabler/icons-react"

import { useAuth } from "@/app/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { listarContasApi } from "@/features/contas/api/contas-api"
import {
  type AnaliseFaturaApi,
  analisarFaturaCartaoApi,
  listarHistoricoImportacaoFaturaApi,
  processarFaturaCartaoApi,
} from "@/features/ia/api/importacao-fatura-api"
import { listarCategoriasApi, type CategoriaApi } from "@/features/transacoes/api/transacoes-api"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"
import { LogoBanco } from "@/shared/components/logo-banco"
import { extrairMensagemErroApi } from "@/shared/lib/api-error"
import {
  formatarData,
  formatarMoeda,
  obterSimboloMoeda,
  parseValorDigitado,
} from "@/shared/lib/formatadores"

function normalizarDescricaoImportacao(descricao: string) {
  return descricao
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

const CATEGORIA_REVISAO_IA = "Para revisar IA"
const GRUPO_REVISAO_IA = "Revisao IA"
const CATEGORIAS_GENERICAS_IA = new Set([
  "",
  "compras diversas",
  "outras despesas",
  "despesas diversas",
  "nao identificada",
])

function itemExigeRevisaoCategoria(item: AnaliseFaturaApi["itens"][number]) {
  if (item.categoriaId) {
    return false
  }

  const categoriaNormalizada = normalizarDescricaoImportacao(item.categoriaNome)

  if (categoriaNormalizada === normalizarDescricaoImportacao(CATEGORIA_REVISAO_IA)) {
    return true
  }

  if (!item.categoriaNova) {
    return false
  }

  return CATEGORIAS_GENERICAS_IA.has(categoriaNormalizada)
}

function prepararItensParaRevisaoCategoria(analise: AnaliseFaturaApi): AnaliseFaturaApi {
  return {
    ...analise,
    itens: analise.itens.map((item) => {
      if (!itemExigeRevisaoCategoria(item)) {
        return item
      }

      return {
        ...item,
        categoriaNome: CATEGORIA_REVISAO_IA,
        grupoCategoria: GRUPO_REVISAO_IA,
        tipoDespesaCategoria: "VARIAVEL" as const,
      }
    }),
  }
}

function deduplicarParcelasProjetadasNaAnalise(
  analise: AnaliseFaturaApi
): AnaliseFaturaApi {
  const grupos = new Map<string, AnaliseFaturaApi["itens"]>()

  analise.itens.forEach((item) => {
    const dataReferencia = item.dataCompraOriginal ?? item.dataLancamento
    const totalParcelas = item.totalParcelas ?? 0
    const chave = [
      normalizarDescricaoImportacao(item.descricao),
      item.valor.toFixed(2),
      dataReferencia,
      String(totalParcelas),
    ].join("|")

    grupos.set(chave, [...(grupos.get(chave) ?? []), item])
  })

  const itensFiltrados: AnaliseFaturaApi["itens"] = []
  const itensIgnorados = [...(analise.itensIgnorados || [])]

  grupos.forEach((grupo) => {
    const ordenados = [...grupo].sort((a, b) => {
      const parcelaA = a.parcelaAtual ?? 0
      const parcelaB = b.parcelaAtual ?? 0

      if (parcelaA !== parcelaB) {
        return parcelaA - parcelaB
      }

      return a.descricao.localeCompare(b.descricao)
    })

    let ultimoMantido: AnaliseFaturaApi["itens"][number] | null = null

    ordenados.forEach((item) => {
      const ehParcelaProjetadaDuplicada =
        ultimoMantido &&
        ultimoMantido.parcelaAtual !== null &&
        item.parcelaAtual !== null &&
        ultimoMantido.totalParcelas !== null &&
        item.totalParcelas !== null &&
        ultimoMantido.totalParcelas === item.totalParcelas &&
        (ultimoMantido.dataCompraOriginal ?? ultimoMantido.dataLancamento) ===
          (item.dataCompraOriginal ?? item.dataLancamento) &&
        item.parcelaAtual === ultimoMantido.parcelaAtual + 1

      if (ehParcelaProjetadaDuplicada) {
        itensIgnorados.push({
          descricao: item.descricao,
          valor: item.valor,
          secaoOrigem: item.secaoOrigem,
          motivo:
            "Parcela projetada para próxima fatura foi ocultada no rascunho para evitar duplicidade.",
        })
        return
      }

      itensFiltrados.push(item)
      ultimoMantido = item
    })
  })

  const resumo = {
    totalItens: itensFiltrados.length,
    totalSelecionados: itensFiltrados.filter((item) => item.selecionado).length,
    totalCategoriasNovas: itensFiltrados.filter(
      (item) =>
        item.selecionado &&
        !item.categoriaId &&
        item.categoriaNome.trim().length > 0 &&
        !itemExigeRevisaoCategoria(item)
    ).length,
    totalParceladasBanco: itensFiltrados.filter(
      (item) => item.tipoParcelamento === "PARCELADA_BANCO"
    ).length,
    totalParceladasExternas: itensFiltrados.filter(
      (item) => item.tipoParcelamento === "PARCELADA_EXTERNA"
    ).length,
    totalAvista: itensFiltrados.filter((item) => item.tipoParcelamento === "AVISTA").length,
    valorSelecionado: itensFiltrados
      .filter((item) => item.selecionado)
      .reduce((total, item) => total + item.valor, 0),
    valorIgnorado: itensIgnorados.reduce((total, item) => total + item.valor, 0),
  }

  return {
    ...analise,
    totalComprasIdentificadas: resumo.valorSelecionado,
    resumo,
    itens: itensFiltrados,
    itensIgnorados,
  }
}

export function PaginaIa() {
  const { moeda } = useAuth()
  const queryClient = useQueryClient()
  const [modalImportacaoAberto, setModalImportacaoAberto] = React.useState(false)
  const [modalRascunhoAberto, setModalRascunhoAberto] = React.useState(false)
  const [contaId, setContaId] = React.useState("")
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [analise, setAnalise] = React.useState<AnaliseFaturaApi | null>(null)
  const [historicoExpandidoId, setHistoricoExpandidoId] = React.useState<string | null>(null)
  const [mensagemErro, setMensagemErro] = React.useState("")
  const [mensagemSucesso, setMensagemSucesso] = React.useState("")

  const contasQuery = useQuery({
    queryKey: ["contas"],
    queryFn: listarContasApi,
  })
  const categoriasQuery = useQuery({
    queryKey: ["categorias"],
    queryFn: listarCategoriasApi,
  })
  const historicoImportacoesQuery = useQuery({
    queryKey: ["historico-importacao-fatura", contaId],
    queryFn: () => listarHistoricoImportacaoFaturaApi(contaId),
    enabled: Boolean(contaId),
  })

  const contas = contasQuery.data ?? []
  const cartoes = contas.filter((conta) => conta.tipo === "cartao_credito")
  const contasSelecionaveis = cartoes.length > 0 ? cartoes : contas
  const semCartaoDedicado = cartoes.length === 0 && contas.length > 0
  const contaSelecionada = contasSelecionaveis.find((conta) => conta.id === contaId) ?? null

  React.useEffect(() => {
    if (!contaId && contasSelecionaveis.length > 0) {
      setContaId(contasSelecionaveis[0].id)
    }
  }, [contaId, contasSelecionaveis])

  React.useEffect(() => {
    setHistoricoExpandidoId(null)
  }, [contaId])

  const analisarMutation = useMutation({
    mutationFn: async () => {
      if (!arquivo) {
        throw new Error("Selecione a fatura em PDF para analisar")
      }
      if (!contaId) {
        throw new Error("Selecione o cartao ou conta de destino")
      }
      return analisarFaturaCartaoApi(contaId, arquivo)
    },
    onSuccess: (data) => {
      setMensagemErro("")
      setMensagemSucesso("")
      setAnalise(prepararItensParaRevisaoCategoria(deduplicarParcelasProjetadasNaAnalise(data)))
      setModalImportacaoAberto(false)
      setModalRascunhoAberto(true)
    },
    onError: (erro) => {
      setMensagemSucesso("")
      setMensagemErro(
        erro instanceof Error
          ? erro.message
          : extrairMensagemErroApi(erro, "Nao foi possivel analisar a fatura.")
      )
    },
  })

  const processarMutation = useMutation({
    mutationFn: async (payload: AnaliseFaturaApi) =>
      processarFaturaCartaoApi({
        contaId: payload.contaId,
        referencia: payload.referencia,
        nomeArquivo: payload.nomeArquivo,
        cartaoFinal: payload.cartaoFinal,
        vencimento: payload.vencimento,
        totalFatura: payload.totalFatura,
        itens: payload.itens,
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["transacoes"] })
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      await queryClient.invalidateQueries({ queryKey: ["categorias"] })
      await queryClient.invalidateQueries({ queryKey: ["historico-importacao-fatura"] })
      setMensagemErro("")
      setMensagemSucesso(
        `${data.totalProcessado} transacoes criadas no sistema. Valor total ${formatarMoeda(
          data.valorTotalProcessado
        )}, incluindo parcelas futuras quando identificadas.`
      )
      setModalRascunhoAberto(false)
    },
    onError: (erro) => {
      setMensagemSucesso("")
      setMensagemErro(extrairMensagemErroApi(erro, "Nao foi possivel processar a fatura."))
    },
  })

  const atualizarItem = (
    itemId: string,
    atualizador: (item: AnaliseFaturaApi["itens"][number]) => AnaliseFaturaApi["itens"][number]
  ) => {
    setAnalise((atual) => {
      if (!atual) {
        return atual
      }

      return {
        ...atual,
        itens: atual.itens.map((item) => (item.id === itemId ? atualizador(item) : item)),
      }
    })
  }

  const categoriasExistentes = React.useMemo(
    () => (categoriasQuery.data ?? []).filter((categoria) => categoria.tipo === "DESPESA"),
    [categoriasQuery.data]
  )
  const itensSelecionados = analise?.itens.filter((item) => item.selecionado) ?? []
  const totalSelecionado = itensSelecionados.reduce((acc, item) => acc + item.valor, 0)
  const totalCategoriasNovas = itensSelecionados.filter(
    (item) => !item.categoriaId && item.categoriaNome.trim().length > 0 && !itemExigeRevisaoCategoria(item)
  ).length
  const contaDestinoAnalise = analise
    ? contas.find((conta) => conta.id === analise.contaId)
    : null
  const diferencaParaFatura = analise ? Math.abs(totalSelecionado - analise.totalFatura) : 0
  const haDivergenciaComFatura = diferencaParaFatura >= 0.01
  const historicoImportacoes = historicoImportacoesQuery.data ?? []

  const formatarDataHoraCurta = (valor?: string | null) => {
    if (!valor) return ""
    const date = new Date(valor)
    if (isNaN(date.getTime())) return ""
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const processarAnalise = async () => {
    if (!analise) {
      return
    }

    const itemInvalido = analise.itens
      .filter((item) => item.selecionado)
      .find((item) => {
        const possuiParcelaAtual = item.parcelaAtual !== null && item.parcelaAtual !== undefined
        const possuiTotalParcelas = item.totalParcelas !== null && item.totalParcelas !== undefined

        if (!possuiParcelaAtual && !possuiTotalParcelas) {
          return false
        }

        if (!possuiParcelaAtual || !possuiTotalParcelas) {
          return true
        }

        return (
          item.parcelaAtual! < 1 ||
          item.totalParcelas! < 2 ||
          item.parcelaAtual! > item.totalParcelas!
        )
      })

    if (itemInvalido) {
      setMensagemSucesso("")
      setMensagemErro(
        `Revise o parcelamento de "${itemInvalido.descricao}". Informe parcela atual e total de parcelas validos, ou deixe ambos vazios para compra a vista.`
      )
      return
    }

    const analiseAProcessar = {
      ...analise,
      itens: analise.itens.map((item) => {
        const categoriaValida =
          item.categoriaId && categoriasExistentes.some((c) => c.id === item.categoriaId)
        
        if (!categoriaValida) {
          return {
            ...item,
            categoriaId: null,
            categoriaNova: true,
            categoriaNome: item.categoriaNome || "Outros",
          }
        }
        return item
      }),
    }

    await processarMutation.mutateAsync(analiseAProcessar)
  }

  const selecionarCategoria = (
    itemId: string,
    valor: string,
    categoriasDisponiveis: CategoriaApi[]
  ) => {
    atualizarItem(itemId, (item) => {
      if (valor === "__nova__") {
        return {
          ...item,
          categoriaId: null,
          categoriaNova: true,
        }
      }

      const categoria = categoriasDisponiveis.find((entry) => entry.id === valor)
      if (!categoria) {
        return item
      }

      return {
        ...item,
        categoriaId: categoria.id,
        categoriaNome: categoria.nome,
        categoriaNova: false,
        grupoCategoria: categoria.grupo,
        tipoDespesaCategoria: categoria.tipoDespesa ?? "VARIAVEL",
      }
    })
  }

  const atualizarParcelamento = (
    itemId: string,
    campo: "parcelaAtual" | "totalParcelas",
    valor: string
  ) => {
    atualizarItem(itemId, (item) => {
      const numero = valor.trim() === "" ? null : Number(valor)
      const parcelaAtual = campo === "parcelaAtual" ? numero : item.parcelaAtual
      const totalParcelas = campo === "totalParcelas" ? numero : item.totalParcelas
      const possuiParcelamento = Boolean(
        parcelaAtual &&
        totalParcelas &&
        Number.isInteger(parcelaAtual) &&
        Number.isInteger(totalParcelas) &&
        parcelaAtual > 0 &&
        totalParcelas > 1
      )

      return {
        ...item,
        [campo]: Number.isFinite(numero) || numero === null ? numero : null,
        tipoParcelamento: possuiParcelamento
          ? item.tipoParcelamento === "PARCELADA_BANCO"
            ? "PARCELADA_BANCO"
            : "PARCELADA_EXTERNA"
          : "AVISTA",
      }
    })
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="IA financeira"
        descricao="Importe sua fatura em PDF, revise o que a IA identificou e so depois processe no sistema."
      />

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <CardHeader>
            <CardTitle>Importar fatura do cartao</CardTitle>
            <CardDescription>
              Fluxo em duas etapas: analisar a fatura com IA e revisar tudo antes da gravacao final.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {mensagemErro ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {mensagemErro}
              </div>
            ) : null}

            {mensagemSucesso ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                {mensagemSucesso}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Dialog open={modalImportacaoAberto} onOpenChange={setModalImportacaoAberto}>
                <DialogTrigger asChild>
                  <Button>
                    <IconFileAnalytics />
                    Importar fatura do cartao
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Importar fatura do cartao</DialogTitle>
                    <DialogDescription>
                      Selecione o cartao de destino e envie o PDF. Depois da leitura, o rascunho completo abre em um
                      segundo modal para revisao antes do processamento.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Cartao ou conta destino</Label>
                        <Select value={contaId} onValueChange={setContaId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione onde a fatura sera importada" />
                          </SelectTrigger>
                          <SelectContent>
                            {contasSelecionaveis.map((conta) => (
                              <SelectItem key={conta.id} value={conta.id}>
                                <div className="flex items-center gap-2">
                                  <LogoBanco instituicao={conta.instituicao} tamanho="sm" />
                                  <span>
                                    {conta.nome} • {conta.instituicao}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Fatura em PDF</Label>
                        <Input
                          accept=".pdf,application/pdf"
                          type="file"
                          onChange={(event) => {
                            setArquivo(event.target.files?.[0] ?? null)
                          }}
                        />
                      </div>
                    </div>

                    {semCartaoDedicado ? (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-amber-700 dark:text-amber-300">
                        Nenhuma conta do tipo cartao de credito foi encontrada. Voce ainda pode importar usando uma conta comum,
                        mas vale cadastrar o cartao na tela de contas para organizar melhor esse fluxo.
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">1. Upload</p>
                        <p className="mt-2 text-sm font-medium">PDF da fatura do mes</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          O sistema extrai o detalhamento do banco e separa compras, creditos e parcelamentos.
                        </p>
                      </div>
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">2. Analise</p>
                        <p className="mt-2 text-sm font-medium">Categorizacao automatica</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          A IA sugere categorias e detecta compras a vista, parceladas externas e parceladas no banco.
                        </p>
                      </div>
                      <div className="rounded-md border border-border/70 p-4">
                        <p className="text-xs  tracking-[0.18em] text-muted-foreground">3. Rascunho</p>
                        <p className="mt-2 text-sm font-medium">Modal de revisao</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          O resultado abre em um modal grande para voce ajustar tudo antes de gravar.
                        </p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      disabled={analisarMutation.isPending || !arquivo || !contaId}
                      onClick={() => void analisarMutation.mutateAsync()}
                    >
                      {analisarMutation.isPending ? (
                        <>
                          <IconLoader2 className="animate-spin" />
                          Enviando PDF para o Gemini...
                        </>
                      ) : (
                        <>
                          <IconFileAnalytics />
                          Analisar fatura
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={modalRascunhoAberto} onOpenChange={setModalRascunhoAberto}>
                <DialogContent className="max-h-[92vh] max-w-7xl overflow-hidden p-0">
                  <div className="flex h-full max-h-[92vh] flex-col">
                    <DialogHeader className="border-b px-6 py-5">
                      <DialogTitle>Rascunho da importacao</DialogTitle>
                      <DialogDescription>
                        Revise os dados lidos da fatura, edite os lancamentos necessarios e processe apenas quando tudo
                        estiver certo.
                      </DialogDescription>
                    </DialogHeader>

                    {analise ? (
                      <div className="flex-1 overflow-y-auto px-6 py-5">
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Itens ativos</p>
                              <p className="mt-2 text-2xl font-semibold">{itensSelecionados.length}</p>
                            </div>
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Valor selecionado</p>
                              <p className="mt-2 text-2xl font-semibold">{formatarMoeda(totalSelecionado)}</p>
                            </div>
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Periodo</p>
                              <p className="mt-2 text-lg font-semibold">
                                {analise.periodoInicio && analise.periodoFim
                                  ? `${formatarData(analise.periodoInicio)} a ${formatarData(analise.periodoFim)}`
                                  : "Nao identificado"}
                              </p>
                            </div>
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Conta de destino</p>
                              <div className="mt-2 flex items-center gap-3">
                                <LogoBanco
                                  instituicao={contaDestinoAnalise?.instituicao}
                                  tamanho="sm"
                                />
                                <p className="text-lg font-semibold">{analise.contaNome}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Total da fatura</p>
                              <p className="mt-2 text-lg font-semibold">{formatarMoeda(analise.totalFatura)}</p>
                            </div>
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Compras identificadas</p>
                              <p className="mt-2 text-lg font-semibold">{formatarMoeda(totalSelecionado)}</p>
                            </div>
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Itens ignorados</p>
                              <p className="mt-2 text-lg font-semibold">{analise.itensIgnorados.length}</p>
                              {analise.resumo.valorIgnorado > 0 ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatarMoeda(analise.resumo.valorIgnorado)} em creditos, pagamentos ou estornos
                                </p>
                              ) : null}
                            </div>
                            <div className="rounded-md border border-border/70 p-4">
                              <p className="text-xs text-muted-foreground">Categorias novas</p>
                              <p className="mt-2 text-lg font-semibold">{totalCategoriasNovas}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Itens em revisao ficam separados para voce validar depois.
                              </p>
                            </div>
                          </div>

                          {haDivergenciaComFatura ? (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-amber-700 dark:text-amber-300">
                              O rascunho reflete as compras e debitos identificados no ciclo. O total da fatura pode ser
                              menor porque o PDF tambem considera saldo anterior, pagamentos e estornos. Nesta leitura,
                              {` ${formatarMoeda(analise.resumo.valorIgnorado)} `}foram mantidos fora da importacao automatica.
                            </div>
                          ) : null}

                          <div className="space-y-3">
                            {analise.itens.map((item) => {
                              const categoriaValida = item.categoriaId && categoriasExistentes.some(c => c.id === item.categoriaId);
                              const valorCategoria = categoriaValida ? (item.categoriaId as string) : "__nova__"

                              return (
                                <div key={item.id} className="rounded-md border border-border/70 p-4">
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <label className="flex items-center gap-3 text-sm font-medium">
                                      <input
                                        checked={item.selecionado}
                                        className="size-4"
                                        type="checkbox"
                                        onChange={(event) => {
                                          atualizarItem(item.id, (atual) => ({
                                            ...atual,
                                            selecionado: event.target.checked,
                                          }))
                                        }}
                                      />
                                      Importar este lancamento
                                    </label>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="secondary">{item.tipoParcelamento}</Badge>
                                      <Badge variant="outline">{item.secaoOrigem}</Badge>
                                      {itemExigeRevisaoCategoria(item) ? (
                                        <Badge variant="outline">Revisao IA</Badge>
                                      ) : item.categoriaNova || !categoriaValida ? (
                                        <Badge variant="outline">Nova categoria</Badge>
                                      ) : (
                                        <Badge variant="outline">Categoria existente</Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.75fr_0.75fr_1fr]">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium">Descricao</Label>
                                      <Input
                                        value={item.descricao}
                                        onChange={(event) => {
                                          atualizarItem(item.id, (atual) => ({
                                            ...atual,
                                            descricao: event.target.value,
                                          }))
                                        }}
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium">Valor em {moeda}</Label>
                                      <CurrencyInput
                                        placeholder={`${obterSimboloMoeda(moeda)} 0,00`}
                                        value={item.valor}
                                        onValueChange={(valorFormatado) => {
                                          atualizarItem(item.id, (atual) => ({
                                            ...atual,
                                            valor: Number.isFinite(parseValorDigitado(valorFormatado))
                                              ? parseValorDigitado(valorFormatado)
                                              : 0,
                                          }))
                                        }}
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium">Data de lancamento</Label>
                                      <Input
                                        type="date"
                                        value={item.dataLancamento}
                                        onChange={(event) => {
                                          atualizarItem(item.id, (atual) => ({
                                            ...atual,
                                            dataLancamento: event.target.value,
                                          }))
                                        }}
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium">Categoria</Label>
                                      <Select
                                        value={valorCategoria}
                                        onValueChange={(valor) =>
                                          selecionarCategoria(item.id, valor, categoriasExistentes)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione uma categoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {categoriasExistentes.map((categoria) => (
                                            <SelectItem key={categoria.id} value={categoria.id}>
                                              {categoria.nome}
                                            </SelectItem>
                                          ))}
                                          <SelectItem value="__nova__">Criar nova categoria</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium">Parcela do mes atual</Label>
                                      <Input
                                        min="1"
                                        step="1"
                                        type="number"
                                        placeholder="Ex: 6"
                                        value={item.parcelaAtual ?? ""}
                                        onChange={(event) =>
                                          atualizarParcelamento(item.id, "parcelaAtual", event.target.value)
                                        }
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium">Total de parcelas</Label>
                                      <Input
                                        min="2"
                                        step="1"
                                        type="number"
                                        placeholder="Ex: 12"
                                        value={item.totalParcelas ?? ""}
                                        onChange={(event) =>
                                          atualizarParcelamento(item.id, "totalParcelas", event.target.value)
                                        }
                                      />
                                    </div>
                                  </div>

                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Preencha os dois campos para importar como parcelada. Se deixar ambos vazios, o
                                    lancamento sera tratado como compra a vista.
                                  </p>

                                  {valorCategoria === "__nova__" ? (
                                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.6fr]">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">
                                          {itemExigeRevisaoCategoria(item)
                                            ? "Categoria para revisao"
                                            : "Nome da nova categoria"}
                                        </Label>
                                        <Input
                                          value={item.categoriaNome}
                                          onChange={(event) => {
                                            atualizarItem(item.id, (atual) => ({
                                              ...atual,
                                              categoriaNome: event.target.value,
                                              categoriaNova: true,
                                            }))
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Grupo sugerido</Label>
                                        <Input
                                          value={item.grupoCategoria}
                                          onChange={(event) => {
                                            atualizarItem(item.id, (atual) => ({
                                              ...atual,
                                              grupoCategoria: event.target.value,
                                            }))
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {item.dataCompraOriginal ? (
                                      <span>Compra original: {formatarData(item.dataCompraOriginal)}</span>
                                    ) : null}
                                    {item.parcelaAtual && item.totalParcelas ? (
                                      <span>
                                        Parcela {item.parcelaAtual}/{item.totalParcelas}
                                      </span>
                                    ) : null}
                                    {item.observacao ? <span>{item.observacao}</span> : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {analise.itensIgnorados.length > 0 ? (
                            <div className="rounded-md border border-dashed border-border/70 p-4">
                              <div className="mb-3 flex items-center gap-2">
                                <IconAlertTriangle className="size-4 text-muted-foreground" />
                                <p className="text-sm font-medium">Itens ignorados automaticamente</p>
                              </div>
                              <div className="space-y-2">
                                {analise.itensIgnorados.map((item, index) => (
                                  <div
                                    key={`${item.descricao}-${index}`}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
                                  >
                                    <div>
                                      <p className="text-sm font-medium">{item.descricao}</p>
                                      <p className="text-xs text-muted-foreground">{item.motivo}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-semibold">{formatarMoeda(item.valor)}</p>
                                      <p className="text-xs text-muted-foreground">{item.secaoOrigem}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-10 text-sm text-muted-foreground">
                        Nenhum rascunho de importacao disponivel ainda.
                      </div>
                    )}

                    <DialogFooter className="border-t px-6 py-4">
                      <Button
                        disabled={processarMutation.isPending || itensSelecionados.length === 0 || !analise}
                        onClick={() => void processarAnalise()}
                      >
                        {processarMutation.isPending ? (
                          <IconLoader2 className="animate-spin" />
                        ) : (
                          <IconReceipt2 />
                        )}
                        Processar no sistema
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
              {analise ? (
                <Button variant="outline" onClick={() => setModalRascunhoAberto(true)}>
                  <IconReceipt2 />
                  Abrir rascunho importado
                </Button>
              ) : null}
              <Badge variant="secondary">
                <IconBrain className="mr-1 size-3.5" />
                IA + parser bancario
              </Badge>
              <Badge variant="outline">
                <IconCheck className="mr-1 size-3.5" />
                Revisao obrigatoria antes de gravar
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border/70 p-4">
                <p className="text-xs  tracking-[0.18em] text-muted-foreground">1. Modal</p>
                <p className="mt-2 text-sm font-medium">Upload guiado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A importacao agora comeca em um modal dedicado, sem ocupar a tela principal.
                </p>
              </div>
              <div className="rounded-md border border-border/70 p-4">
                <p className="text-xs  tracking-[0.18em] text-muted-foreground">2. IA</p>
                <p className="mt-2 text-sm font-medium">Leitura e classificacao</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A analise continua identificando categorias, parcelamentos externos e parcelamentos do banco.
                </p>
              </div>
              <div className="rounded-md border border-border/70 p-4">
                <p className="text-xs  tracking-[0.18em] text-muted-foreground">3. Rascunho</p>
                <p className="mt-2 text-sm font-medium">Revisao em modal grande</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O rascunho completo com edicao dos itens tambem abre em modal, com scroll proprio.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo da leitura</CardTitle>
            <CardDescription>
              Metadados da fatura, qualidade da classificacao e o que sera ou nao importado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!analise ? (
              <div className="rounded-md border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                Apos a analise, esta area mostra referencia da fatura, total identificado, itens ignorados e o
                provedor usado para a categorizacao.
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border/70 p-4">
                    <p className="text-xs  tracking-[0.18em] text-muted-foreground">Referencia</p>
                    <p className="mt-2 text-lg font-semibold">{analise.referencia}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vence em {formatarData(analise.vencimento)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 p-4">
                    <p className="text-xs  tracking-[0.18em] text-muted-foreground">Cartao</p>
                    <p className="mt-2 text-lg font-semibold">
                      {analise.contaNome}
                      {analise.cartaoFinal ? ` • final ${analise.cartaoFinal}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground truncate">{analise.nomeArquivo}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-border/70 p-4">
                    <p className="text-xs text-muted-foreground">Total da fatura</p>
                    <p className="mt-2 text-lg font-semibold">{formatarMoeda(analise.totalFatura)}</p>
                  </div>
                  <div className="rounded-md border border-border/70 p-4">
                    <p className="text-xs text-muted-foreground">Compras identificadas</p>
                    <p className="mt-2 text-lg font-semibold">{formatarMoeda(totalSelecionado)}</p>
                  </div>
                  <div className="rounded-md border border-border/70 p-4">
                    <p className="text-xs text-muted-foreground">Itens ignorados</p>
                    <p className="mt-2 text-lg font-semibold">{analise.itensIgnorados.length}</p>
                    {analise.resumo.valorIgnorado > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatarMoeda(analise.resumo.valorIgnorado)} em creditos, pagamentos ou estornos
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border/70 p-4">
                    <p className="text-xs text-muted-foreground">Categorias novas</p>
                    <p className="mt-2 text-lg font-semibold">{totalCategoriasNovas}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {analise.fonteExtracao === "gemini_vision" ? (
                      <>
                        <IconRobot className="mr-1 size-3.5" />
                        Gemini Vision
                      </>
                    ) : (
                      <>
                        <IconTool className="mr-1 size-3.5" />
                        Parser regex
                      </>
                    )}
                  </Badge>
                  <Badge variant="secondary">
                    <IconSparkles className="mr-1 size-3.5" />
                    {analise.provedorCategorizacao === "gemini" ? "Gemini categorizou" : "Fallback heurístico"}
                  </Badge>
                  <Badge variant="outline">
                    Parceladas banco: {analise.itens.filter((item) => item.tipoParcelamento === "PARCELADA_BANCO").length}
                  </Badge>
                  <Badge variant="outline">
                    Parceladas externas:{" "}
                    {analise.itens.filter((item) => item.tipoParcelamento === "PARCELADA_EXTERNA").length}
                  </Badge>
                  <Badge variant="outline">
                    A vista: {analise.itens.filter((item) => item.tipoParcelamento === "AVISTA").length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  O total da fatura e o total importavel podem ser diferentes. O importavel considera apenas os
                  lancamentos do ciclo atual que entram como transacao, enquanto o total da fatura inclui saldo
                  anterior, pagamentos e creditos.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Historico de importacoes por cartao</CardTitle>
              <CardDescription>
                Cada processamento vira um registro permanente para evitar que a proxima fatura repita gastos ja importados.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm text-muted-foreground">
              <IconHistory className="size-4" />
              {contaSelecionada ? contaSelecionada.nome : "Selecione um cartao"}
            </div>
          </CardHeader>
          <CardContent>
            {!contaId ? (
              <div className="rounded-md border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                Escolha um cartao para ver o historico das faturas processadas.
              </div>
            ) : historicoImportacoesQuery.isLoading ? (
              <div className="rounded-md border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                Carregando historico de importacoes...
              </div>
            ) : historicoImportacoes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                Ainda nao ha importacoes processadas para este cartao. A primeira importacao concluida passa a alimentar o historico e a bloquear repeticoes futuras.
              </div>
            ) : (
              <div className="space-y-3">
                {historicoImportacoes.map((importacao) => (
                  <div key={importacao.id} className="rounded-md border border-border/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{importacao.referencia}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {importacao.vencimento
                            ? `Vence em ${formatarData(importacao.vencimento)}`
                            : "Vencimento nao informado"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {importacao.cartaoFinal
                            ? `${importacao.contaNome} • final ${importacao.cartaoFinal}`
                            : importacao.contaNome}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setHistoricoExpandidoId((atual) =>
                              atual === importacao.id ? null : importacao.id
                            )
                          }
                        >
                          {historicoExpandidoId === importacao.id
                            ? "Ocultar transacoes"
                            : `Ver transacoes (${(importacao.transacoes || []).length})`}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Importado do PDF</span>
                        <span className="font-medium">{formatarMoeda(importacao.valorImportadoPdf)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Itens processados</span>
                        <span className="font-medium">{importacao.totalItensImportados}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Lancamentos gerados</span>
                        <span className="font-medium">{importacao.totalLancamentosGerados}</span>
                      </div>
                      {importacao.totalFatura ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Total da fatura</span>
                          <span className="font-medium">{formatarMoeda(importacao.totalFatura)}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                      <p>{importacao.nomeArquivo}</p>
                      <p className="mt-1">Processada em {formatarDataHoraCurta(importacao.importadoEm)}</p>
                    </div>
                    {historicoExpandidoId === importacao.id ? (
                      <div className="mt-4 border-t pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {(importacao.transacoes || []).length} registro(s) vinculados
                          </p>
                        </div>
                        <div className="space-y-2">
                          {(importacao.transacoes || []).map((transacao) => (
                            <div
                              key={transacao.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{transacao.descricao}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatarData(transacao.dataReferencia)}</span>
                                  {transacao.parcelaAtual && transacao.totalParcelas ? (
                                    <Badge variant="outline">
                                      {transacao.parcelaAtual}/{transacao.totalParcelas}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">A vista</Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm font-semibold">{formatarMoeda(transacao.valor)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>O que a IA identifica</CardTitle>
            <CardDescription>
              A leitura atual foi pensada para faturas Santander como as suas amostras, com fallback seguro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <IconCreditCard className="size-4 text-primary" />
                <p className="text-sm font-medium">Parcelamentos no banco</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Linhas com juros e IOF sao marcadas como parceladas no proprio banco e recebem observacao adicional.
              </p>
            </div>
            <div className="rounded-md border border-border/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <IconReceipt2 className="size-4 text-primary" />
                <p className="text-sm font-medium">Parcelamentos externos</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Compras com parcela 01/12, 02/12 e afins viram uma serie completa no sistema, incluindo os meses futuros.
              </p>
            </div>
            <div className="rounded-md border border-border/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <IconCheck className="size-4 text-primary" />
                <p className="text-sm font-medium">Categorias automaticas</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando a categoria nao existe, a sugestao vem pronta e pode virar uma nova categoria no processamento final.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo que fica disponivel no sistema</CardTitle>
            <CardDescription>
              O processo foi desenhado para evitar insercao cega e te dar controle total antes de gravar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border/70 p-4">
              <p className="text-sm font-medium">Upload e leitura</p>
              <p className="mt-1 text-xs text-muted-foreground">
                O backend recebe o PDF, extrai o texto, localiza o detalhamento da fatura e separa as secoes.
              </p>
            </div>
            <div className="rounded-md border border-border/70 p-4">
              <p className="text-sm font-medium">Preview com IA</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada compra ganha sugestao de categoria, tipo de parcelamento e data de lancamento recomendada.
              </p>
            </div>
            <div className="rounded-md border border-border/70 p-4">
              <p className="text-sm font-medium">Persistencia controlada</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No processamento, categorias ausentes sao criadas e as transacoes selecionadas entram no sistema com rastreio da fatura.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
