import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  IconArrowsExchange,
  IconCar,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconCoin,
  IconDeviceLaptop,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconFolders,
  IconHome,
  IconPlus,
  IconSearch,
  IconShoppingCart,
  IconSparkles,
  IconTag,
  IconTrash,
  IconTrendingUp,
  IconWand,
  IconWallet,
  IconX,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"
import { extrairMensagemErroApi } from "@/shared/lib/api-error"
import {
  atualizarCategoriaApi,
  atualizarVisibilidadeGrupoCategoriaApi,
  criarCategoriaApi,
  excluirCategoriaApi,
  excluirGrupoCategoriaApi,
  listarCategoriasApi,
  renomearGrupoCategoriaApi,
} from "@/features/transacoes/api/transacoes-api"
import type { CategoriaApi } from "@/features/transacoes/api/transacoes-api"

type FiltroTipo = CategoriaApi["tipo"]
type ModoVisualizacao = "GRUPOS" | "CATEGORIAS"
type TipoDespesa = Exclude<CategoriaApi["tipoDespesa"], null>

type GrupoCategoria = {
  id: string
  titulo: string
  descricao: string
  destaque: string
  brilho: string
  emoji: string
  categorias: CategoriaApi[]
  oculto: boolean
}

type FormularioCategoria = {
  nome: string
  cor: string
  icone: string
  tipo: FiltroTipo
  grupo: string
  ocultarRelatorios: boolean
  tipoDespesa: TipoDespesa
}

type GrupoEditando = {
  grupoAtual: string
  grupoNovo: string
  ocultarRelatorios: boolean
}

type ConfirmacaoExclusao =
  | { tipo: "categoria"; id: string; nome: string }
  | { tipo: "grupo"; id: string; nome: string }

const formularioPadrao: FormularioCategoria = {
  nome: "",
  cor: "#14b8a6",
  icone: "🏷️",
  tipo: "DESPESA",
  grupo: "Outros grupos",
  ocultarRelatorios: false,
  tipoDespesa: "VARIAVEL",
}

const aparenciasGrupo = [
  {
    palavras: ["aliment", "mercado", "restaurante", "bebida", "ifood", "lanche", "comida"],
    titulo: "Alimentos e bebidas",
    descricao: "Compras, refeicoes e consumo recorrente.",
    destaque: "from-amber-100/90 via-orange-50 to-white",
    brilho: "bg-amber-500/12 text-amber-700",
    emoji: "🍽️",
  },
  {
    palavras: ["moradia", "casa", "aluguel", "energia", "agua", "internet", "telecom"],
    titulo: "Casa e estrutura",
    descricao: "Moradia, contas fixas e servicos essenciais.",
    destaque: "from-sky-100/90 via-cyan-50 to-white",
    brilho: "bg-sky-500/12 text-sky-700",
    emoji: "🏠",
  },
  {
    palavras: ["transporte", "uber", "mobilidade", "viagem", "gasolina", "combustivel"],
    titulo: "Mobilidade e viagens",
    descricao: "Deslocamentos, corridas, passagens e logistica.",
    destaque: "from-blue-100/90 via-indigo-50 to-white",
    brilho: "bg-blue-500/12 text-blue-700",
    emoji: "🚗",
  },
  {
    palavras: ["emprest", "financi", "juros", "cartao", "imposto", "seguro", "obrig"],
    titulo: "Financeiro e obrigacoes",
    descricao: "Compromissos financeiros, credito e encargos.",
    destaque: "from-slate-200/90 via-slate-100 to-white",
    brilho: "bg-slate-500/12 text-slate-700",
    emoji: "🏦",
  },
  {
    palavras: ["saude", "farmacia", "medico", "academia", "terapia"],
    titulo: "Saude e bem-estar",
    descricao: "Cuidados pessoais e saude preventiva.",
    destaque: "from-emerald-100/90 via-teal-50 to-white",
    brilho: "bg-emerald-500/12 text-emerald-700",
    emoji: "💊",
  },
  {
    palavras: ["invest", "aporte", "fii", "acao", "cripto", "tesouro"],
    titulo: "Investimentos",
    descricao: "Patrimonio, reservas e alocacao de capital.",
    destaque: "from-violet-100/90 via-fuchsia-50 to-white",
    brilho: "bg-violet-500/12 text-violet-700",
    emoji: "📈",
  },
]

const mapaIconesCategoria = {
  tag: IconTag,
  "shopping-cart": IconShoppingCart,
  cart: IconShoppingCart,
  sparkles: IconSparkles,
  wallet: IconWallet,
  car: IconCar,
  home: IconHome,
  house: IconHome,
  laptop: IconDeviceLaptop,
  internet: IconDeviceLaptop,
} as const

const opcoesEmojiCategoria = [
  { valor: "🏷️", rotulo: "Tag" },
  { valor: "🛒", rotulo: "Compras" },
  { valor: "🍔", rotulo: "Comida" },
  { valor: "☕", rotulo: "Cafe" },
  { valor: "🏠", rotulo: "Casa" },
  { valor: "🚗", rotulo: "Carro" },
  { valor: "🚌", rotulo: "Transporte" },
  { valor: "💳", rotulo: "Cartao" },
  { valor: "💸", rotulo: "Gastos" },
  { valor: "💰", rotulo: "Receita" },
  { valor: "📱", rotulo: "Celular" },
  { valor: "💻", rotulo: "Digital" },
  { valor: "🎮", rotulo: "Lazer" },
  { valor: "🎬", rotulo: "Streaming" },
  { valor: "💊", rotulo: "Saude" },
  { valor: "🏋️", rotulo: "Academia" },
  { valor: "✈️", rotulo: "Viagem" },
  { valor: "📈", rotulo: "Investimento" },
] as const

function normalizarTexto(valor: string | null | undefined) {
  if (!valor) return ""
  return valor
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function obterAparenciaGrupo(grupo: string | null | undefined) {
  const grupoNormalizado = normalizarTexto(grupo)

  return (
    aparenciasGrupo.find((item) =>
      item.palavras.some((palavra) => grupoNormalizado.includes(normalizarTexto(palavra)))
    ) ?? {
      titulo: grupo || "Outros grupos",
      descricao: "Colecao personalizada de categorias do seu fluxo.",
      destaque: "from-zinc-100/90 via-white to-white",
      brilho: "bg-zinc-500/12 text-zinc-700",
      emoji: "🧩",
    }
  )
}

function corComFallback(cor?: string) {
  return cor && cor.trim().length > 0 ? cor : "#94a3b8"
}

function ehEmojiOuCaractereVisual(valor: string) {
  return !/^[a-z0-9-_\s]+$/i.test(valor.trim())
}

function renderizarIconeCategoria(icone?: string, className = "size-5") {
  const valor = icone?.trim()

  if (!valor) {
    return <IconTag className={className} />
  }

  if (ehEmojiOuCaractereVisual(valor)) {
    return <span className="leading-none">{valor}</span>
  }

  const Icone = mapaIconesCategoria[valor.toLowerCase() as keyof typeof mapaIconesCategoria]
  return Icone ? <Icone className={className} /> : <IconTag className={className} />
}

function agruparCategorias(categorias: CategoriaApi[]) {
  const mapa = new Map<string, GrupoCategoria>()

  categorias.forEach((categoria) => {
    const base = obterAparenciaGrupo(categoria.grupo)
    const existente = mapa.get(categoria.grupo)

    if (existente) {
      existente.categorias.push(categoria)
      existente.oculto = existente.oculto && categoria.ocultarRelatorios
      return
    }

    mapa.set(categoria.grupo, {
      id: categoria.grupo,
      titulo: categoria.grupo || base.titulo,
      descricao: base.descricao,
      destaque: base.destaque,
      brilho: base.brilho,
      emoji: base.emoji,
      categorias: [categoria],
      oculto: categoria.ocultarRelatorios,
    })
  })

  return Array.from(mapa.values()).sort(
    (a, b) => b.categorias.length - a.categorias.length || a.titulo.localeCompare(b.titulo)
  )
}

function mapearCategoriaParaFormulario(categoria: CategoriaApi): FormularioCategoria {
  return {
    nome: categoria.nome,
    cor: categoria.cor,
    icone: categoria.icone,
    tipo: categoria.tipo,
    grupo: categoria.grupo,
    ocultarRelatorios: categoria.ocultarRelatorios,
    tipoDespesa: categoria.tipoDespesa ?? "VARIAVEL",
  }
}

function metricaTipo(rotulo: string, valor: number, destaque: string, icone: React.ReactNode) {
  return { rotulo, valor, destaque, icone }
}

function classesBotaoTipo(ativo: boolean) {
  return ativo
    ? "border-primary/50 bg-primary/8 text-primary "
    : "border-border/70 bg-background text-foreground/88 hover:border-primary/30 hover:bg-muted/20"
}

export function PaginaCategoria() {
  const queryClient = useQueryClient()
  const [busca, setBusca] = React.useState("")
  const [filtroTipo, setFiltroTipo] = React.useState<FiltroTipo>("DESPESA")
  const [modoVisualizacao, setModoVisualizacao] = React.useState<ModoVisualizacao>("GRUPOS")
  const [sheetCriacaoAberto, setSheetCriacaoAberto] = React.useState(false)
  const [sheetEdicaoAberto, setSheetEdicaoAberto] = React.useState(false)
  const [sheetGrupoAberto, setSheetGrupoAberto] = React.useState(false)
  const [formularioCategoria, setFormularioCategoria] =
    React.useState<FormularioCategoria>(formularioPadrao)
  const [categoriaEditando, setCategoriaEditando] = React.useState<CategoriaApi | null>(null)
  const [grupoEditando, setGrupoEditando] = React.useState<GrupoEditando | null>(null)
  const [mensagemErro, setMensagemErro] = React.useState<string | null>(null)
  const [confirmacaoExclusao, setConfirmacaoExclusao] =
    React.useState<ConfirmacaoExclusao | null>(null)

  const categoriasQuery = useQuery({
    queryKey: ["categorias", "pagina"],
    queryFn: listarCategoriasApi,
  })

  const invalidarCategorias = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["categorias"] })
  }, [queryClient])

  const criarCategoriaMutation = useMutation({
    mutationFn: criarCategoriaApi,
    onSuccess: async () => {
      await invalidarCategorias()
      setFormularioCategoria(formularioPadrao)
      setSheetCriacaoAberto(false)
      setMensagemErro(null)
    },
    onError: (erro) => {
      setMensagemErro(extrairMensagemErroApi(erro, "Nao foi possivel criar a categoria."))
    },
  })

  const atualizarCategoriaMutation = useMutation({
    mutationFn: ({
      categoriaId,
      payload,
    }: {
      categoriaId: string
      payload: FormularioCategoria
    }) =>
      atualizarCategoriaApi(categoriaId, {
        ...payload,
        tipoDespesa: payload.tipo === "DESPESA" ? payload.tipoDespesa : undefined,
      }),
    onSuccess: async () => {
      await invalidarCategorias()
      setCategoriaEditando(null)
      setSheetEdicaoAberto(false)
      setMensagemErro(null)
    },
    onError: (erro) => {
      setMensagemErro(extrairMensagemErroApi(erro, "Nao foi possivel atualizar a categoria."))
    },
  })

  const excluirCategoriaMutation = useMutation({
    mutationFn: excluirCategoriaApi,
    onSuccess: async () => {
      await invalidarCategorias()
      setCategoriaEditando(null)
      setSheetEdicaoAberto(false)
      setMensagemErro(null)
    },
    onError: (erro) => {
      setMensagemErro(extrairMensagemErroApi(erro, "Nao foi possivel excluir a categoria."))
    },
  })

  const renomearGrupoMutation = useMutation({
    mutationFn: ({ grupoAtual, grupoNovo }: { grupoAtual: string; grupoNovo: string }) =>
      renomearGrupoCategoriaApi(grupoAtual, grupoNovo),
    onSuccess: async () => {
      await invalidarCategorias()
      setGrupoEditando(null)
      setSheetGrupoAberto(false)
      setMensagemErro(null)
    },
    onError: (erro) => {
      setMensagemErro(extrairMensagemErroApi(erro, "Nao foi possivel atualizar o grupo."))
    },
  })

  const atualizarVisibilidadeGrupoMutation = useMutation({
    mutationFn: ({
      grupoAtual,
      ocultarRelatorios,
    }: {
      grupoAtual: string
      ocultarRelatorios: boolean
    }) => atualizarVisibilidadeGrupoCategoriaApi(grupoAtual, ocultarRelatorios),
    onSuccess: async () => {
      await invalidarCategorias()
      setMensagemErro(null)
    },
    onError: (erro) => {
      setMensagemErro(
        extrairMensagemErroApi(erro, "Nao foi possivel alterar a visibilidade do grupo.")
      )
    },
  })

  const excluirGrupoMutation = useMutation({
    mutationFn: excluirGrupoCategoriaApi,
    onSuccess: async () => {
      await invalidarCategorias()
      setGrupoEditando(null)
      setSheetGrupoAberto(false)
      setMensagemErro(null)
    },
    onError: (erro) => {
      setMensagemErro(extrairMensagemErroApi(erro, "Nao foi possivel excluir o grupo."))
    },
  })

  const categorias = categoriasQuery.data ?? []
  const categoriasFiltradas = categorias
    .filter((categoria) => categoria.tipo === filtroTipo)
    .filter((categoria) => {
      const alvo = normalizarTexto(`${categoria.nome} ${categoria.icone} ${categoria.grupo}`)
      return alvo.includes(normalizarTexto(busca))
    })
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const grupos = agruparCategorias(categoriasFiltradas)
  const totalPersonalizadas = categorias.filter((categoria) => categoria.cor !== "#14b8a6").length
  const totaisPorTipo = {
    DESPESA: categorias.filter((categoria) => categoria.tipo === "DESPESA").length,
    RECEITA: categorias.filter((categoria) => categoria.tipo === "RECEITA").length,
    TRANSFERENCIA: categorias.filter((categoria) => categoria.tipo === "TRANSFERENCIA").length,
    INVESTIMENTO: categorias.filter((categoria) => categoria.tipo === "INVESTIMENTO").length,
  }

  const metricas = [
    metricaTipo(
      "Categorias",
      categorias.length,
      "from-zinc-100 via-zinc-50 to-white",
      <IconTag className="size-5" />
    ),
    metricaTipo(
      "Grupos",
      agruparCategorias(categorias).length,
      "from-blue-100 via-sky-50 to-white",
      <IconFolders className="size-5" />
    ),
    metricaTipo(
      "Personalizadas",
      totalPersonalizadas,
      "from-amber-100 via-orange-50 to-white",
      <IconSparkles className="size-5" />
    ),
  ]

  const abrirCriacao = () => {
    setMensagemErro(null)
    setFormularioCategoria({
      ...formularioPadrao,
      tipo: filtroTipo,
      grupo: grupos[0]?.titulo ?? "Outros grupos",
    })
    setSheetCriacaoAberto(true)
  }

  const abrirEdicao = (categoria: CategoriaApi) => {
    setMensagemErro(null)
    setCategoriaEditando(categoria)
    setFormularioCategoria(mapearCategoriaParaFormulario(categoria))
    setSheetEdicaoAberto(true)
  }

  const abrirEdicaoGrupo = (grupo: GrupoCategoria) => {
    setMensagemErro(null)
    setGrupoEditando({
      grupoAtual: grupo.titulo,
      grupoNovo: grupo.titulo,
      ocultarRelatorios: grupo.oculto,
    })
    setSheetGrupoAberto(true)
  }

  const salvarNovaCategoria = async () => {
    if (!formularioCategoria.nome.trim()) {
      return
    }

    await criarCategoriaMutation.mutateAsync({
      ...formularioCategoria,
      tipoDespesa:
        formularioCategoria.tipo === "DESPESA" ? formularioCategoria.tipoDespesa : undefined,
    })
  }

  const salvarEdicaoCategoria = async () => {
    if (!categoriaEditando || !formularioCategoria.nome.trim()) {
      return
    }

    await atualizarCategoriaMutation.mutateAsync({
      categoriaId: categoriaEditando.id,
      payload: formularioCategoria,
    })
  }

  const salvarGrupoEditado = async () => {
    if (!grupoEditando || !grupoEditando.grupoNovo.trim()) {
      return
    }

    await renomearGrupoMutation.mutateAsync({
      grupoAtual: grupoEditando.grupoAtual,
      grupoNovo: grupoEditando.grupoNovo.trim(),
    })
  }

  const confirmarExclusao = async () => {
    if (!confirmacaoExclusao) {
      return
    }

    if (confirmacaoExclusao.tipo === "categoria") {
      await excluirCategoriaMutation.mutateAsync(confirmacaoExclusao.id)
      setConfirmacaoExclusao(null)
      return
    }

    await excluirGrupoMutation.mutateAsync(confirmacaoExclusao.id)
    setConfirmacaoExclusao(null)
  }

  const renderEditorCategoria = () => (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
      <section className="rounded-md border border-border/70 bg-linear-to-br from-background via-background to-muted/25 p-5 ">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div
            className="flex size-28 shrink-0 items-center justify-center rounded-md border border-white/80 text-5xl shadow-inner"
            style={{
              background: `linear-gradient(135deg, ${corComFallback(formularioCategoria.cor)}25, #ffffff)`,
            }}
          >
            {renderizarIconeCategoria(formularioCategoria.icone, "size-12")}
          </div>
          <div className="space-y-1.5">
            <Input
              className="p-4"
              placeholder="Nome da categoria"
              value={formularioCategoria.nome}
              onChange={(event) =>
                setFormularioCategoria((atual) => ({ ...atual, nome: event.target.value }))
              }
            />
              <Input
                className="p-4"
                placeholder="Grupo"
                value={formularioCategoria.grupo}
                onChange={(event) =>
                  setFormularioCategoria((atual) => ({ ...atual, grupo: event.target.value }))
                }
              />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="w-full h-10 rounded-md hover:cursor-pointer"
                  type="button"
                  variant="outline"
                >
                  <span className="text-base leading-none w-full text-center">
                    {ehEmojiOuCaractereVisual(formularioCategoria.icone)
                      ? formularioCategoria.icone
                      : "😊"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[20rem] rounded-md p-3">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Selecionar emoji</p>
                    <p className="text-xs text-muted-foreground">
                      Escolha um emoji rapido para a categoria.
                    </p>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {opcoesEmojiCategoria.map((emoji) => (
                      <Button
                        key={emoji.valor}
                        className={`h-11 rounded-md border p-0 text-lg transition ${formularioCategoria.icone === emoji.valor
                          ? "border-primary/45 bg-primary/7 "
                          : "border-border/70 bg-background hover:border-primary/25 hover:bg-muted/30"
                          }`}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setFormularioCategoria((atual) => ({
                            ...atual,
                            icone: emoji.valor,
                          }))
                        }
                      >
                        <span aria-label={emoji.rotulo}>{emoji.valor}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          Tipo
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["DESPESA", "RECEITA", "TRANSFERENCIA", "INVESTIMENTO"] as const).map((tipo) => (
            <Button
              key={tipo}
              className={`p-4 border transition ${classesBotaoTipo(formularioCategoria.tipo === tipo)
                }`}
              type="button"
              variant="outline"
              onClick={() =>
                setFormularioCategoria((atual) => ({
                  ...atual,
                  tipo,
                  tipoDespesa: tipo === "DESPESA" ? atual.tipoDespesa : "VARIAVEL",
                }))
              }
            >
              {tipo === "DESPESA"
                ? "Despesa"
                : tipo === "RECEITA"
                  ? "Receita"
                  : tipo === "TRANSFERENCIA"
                    ? "Transferencia"
                    : "Investimento"}
            </Button>
          ))}
        </div>
      </section>

      {formularioCategoria.tipo === "DESPESA" ? (
        <section className="space-y-3">
          <p className="text-muted-foreground">
            Tipo de despesa
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["FIXA", "VARIAVEL"] as const).map((tipoDespesa) => (
              <Button
                key={tipoDespesa}
                className={`border p-4 py-5 text-left transition ${formularioCategoria.tipoDespesa === tipoDespesa
                  ? "border-primary/50 bg-primary/6"
                  : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20"
                  }`}
                type="button"
                variant="outline"
                onClick={() =>
                  setFormularioCategoria((atual) => ({ ...atual, tipoDespesa }))
                }
              >
                {tipoDespesa === "FIXA" ? "Valor recorrente" : "Valor muda"}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <p className="text-muted-foreground">
          Aparência
        </p>
        <div className="flex items-center">
          <Input
            aria-label="Selecionar cor"
            className="size-11 cursor-pointer rounded-md border hover:cursor-pointer "
            type="color"
            style={{ borderColor: formularioCategoria.cor, backgroundColor: `${formularioCategoria.cor}20` }}
            value={formularioCategoria.cor}
            onChange={(event) =>
              setFormularioCategoria((atual) => ({ ...atual, cor: event.target.value }))
            }
          />
          <Input
            className={`h-11 rounded-md disabled ml-2 `}
            value={formularioCategoria.cor}
            disabled
            onChange={(event) =>
              setFormularioCategoria((atual) => ({ ...atual, cor: event.target.value }))
            }
          />
        </div>
      </section>

      <section className="rounded-md border border-border/70 bg-muted/15 p-4">
        <div className="flex items-start justify-between gap-4 rounded-md bg-background px-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Ocultar dos relatorios</p>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Mantem a categoria no sistema, mas tira dos resumos principais.
            </p>
          </div>
          <Button
            className="rounded-md px-4"
            size="sm"
            variant={formularioCategoria.ocultarRelatorios ? "default" : "outline"}
            onClick={() =>
              setFormularioCategoria((atual) => ({
                ...atual,
                ocultarRelatorios: !atual.ocultarRelatorios,
              }))
            }
          >
            {formularioCategoria.ocultarRelatorios ? "Oculta" : "Visivel"}
          </Button>
        </div>
      </section>
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CabecalhoPagina
        titulo="Categorias"
        descricao="Organize suas transacoes com grupos, visibilidade e comportamento financeiro."
        acoes={
          <Button className="rounded-md" onClick={abrirCriacao}>
            <IconPlus />
            Criar
          </Button>
        }
      />

      <Sheet open={sheetCriacaoAberto} onOpenChange={setSheetCriacaoAberto}>
        <SheetContent className="overflow-y-auto p-0 sm:max-w-[34rem]">
          <SheetHeader className="border-b border-border/60 px-6 py-6">
            <SheetTitle>Nova categoria</SheetTitle>
            <SheetDescription>
              Defina o grupo, o tipo e os dados visuais da categoria.
            </SheetDescription>
          </SheetHeader>
          {renderEditorCategoria()}
          <SheetFooter className="border-t border-border/60 bg-background/95 px-6 py-5 backdrop-blur-sm">
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setSheetCriacaoAberto(false)
                  setMensagemErro(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                className="rounded-md px-8"
                disabled={criarCategoriaMutation.isPending}
                onClick={() => void salvarNovaCategoria()}
              >
                {criarCategoriaMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={sheetEdicaoAberto} onOpenChange={setSheetEdicaoAberto}>
        <SheetContent className="overflow-y-auto p-0 sm:max-w-[34rem]" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Editar categoria</SheetTitle>
            <SheetDescription>Atualize os detalhes da categoria.</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-start border-b border-border/60 px-4 py-4">
            <Button
              variant="ghost"
              size="icon-sm"
              className="justify-self-start hover:cursor-pointer"
              onClick={() => {
                setSheetEdicaoAberto(false)
                setCategoriaEditando(null)
                setMensagemErro(null)
              }}
            >
              <IconX className="size-4 text-muted-foreground" />
              <span className="sr-only">Fechar categoria</span>
            </Button>
            <div className="space-y-1 px-3 text-center">
              <p className="text-[11px] font-semibold  tracking-[0.18em] text-muted-foreground">
                Categoria
              </p>
              <p className="text-sm text-muted-foreground">
                {categoriaEditando?.nome ?? "Editar categoria"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="justify-self-end hover:cursor-pointer"
                >
                  <IconDotsVertical className="size-4 text-muted-foreground" />
                  <span className="sr-only">Mais acoes da categoria</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 min-w-56">
                <DropdownMenuItem
                  onClick={() => {
                    if (!categoriaEditando || !navigator.clipboard) {
                      return
                    }

                    void navigator.clipboard.writeText(categoriaEditando.id)
                  }}
                >
                  <IconCopy />
                  Copiar ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    if (!categoriaEditando) {
                      return
                    }

                    setConfirmacaoExclusao({
                      tipo: "categoria",
                      id: categoriaEditando.id,
                      nome: categoriaEditando.nome,
                    })
                  }}
                >
                  <IconTrash />
                  Excluir categoria
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {renderEditorCategoria()}
          <SheetFooter className="border-t border-border/60 bg-background/95 px-6 py-5 backdrop-blur-sm">
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setSheetEdicaoAberto(false)
                  setCategoriaEditando(null)
                  setMensagemErro(null)
                }}
              >
                Cancelar
              </Button>
              <div className="flex items-center gap-2">
                {categoriaEditando ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setConfirmacaoExclusao({
                        tipo: "categoria",
                        id: categoriaEditando.id,
                        nome: categoriaEditando.nome,
                      })
                    }
                  >
                    Excluir
                  </Button>
                ) : null}
                <Button
                  className="rounded-md px-8"
                  disabled={atualizarCategoriaMutation.isPending}
                  onClick={() => void salvarEdicaoCategoria()}
                >
                  {atualizarCategoriaMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={sheetGrupoAberto} onOpenChange={setSheetGrupoAberto}>
        <SheetContent className="overflow-y-auto p-0 sm:max-w-[32rem]">
          <SheetHeader className="border-b border-border/60 px-6 py-6">
            <SheetTitle>Editar grupo</SheetTitle>
            <SheetDescription>Ajuste o nome e a visibilidade do grupo.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-6 py-6">
            <div className="rounded-md border border-border/70 bg-muted/15 p-4">
              <div className="space-y-2 rounded-md bg-background p-4">
                <Label className="text-[11px] font-medium  tracking-[0.16em] text-muted-foreground">
                  Nome do grupo
                </Label>
                <Input
                  className="h-11 rounded-md border-border/70"
                  placeholder="Ex.: Emprestimos e financiamento"
                  value={grupoEditando?.grupoNovo ?? ""}
                  onChange={(event) =>
                    setGrupoEditando((atual) =>
                      atual
                        ? {
                          ...atual,
                          grupoNovo: event.target.value,
                        }
                        : atual
                    )
                  }
                />
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/15 p-4">
              <div className="flex items-start justify-between gap-4 rounded-md bg-background px-4 py-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Ocultar dos relatorios</p>
                  <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                    Aplica a visibilidade em todas as categorias do grupo.
                  </p>
                </div>
                <Button
                  className="rounded-md px-4"
                  size="sm"
                  variant={grupoEditando?.ocultarRelatorios ? "default" : "outline"}
                  onClick={() =>
                    setGrupoEditando((atual) =>
                      atual
                        ? {
                          ...atual,
                          ocultarRelatorios: !atual.ocultarRelatorios,
                        }
                        : atual
                    )
                  }
                >
                  {grupoEditando?.ocultarRelatorios ? "Oculto" : "Visivel"}
                </Button>
              </div>
            </div>
          </div>
          <SheetFooter className="border-t border-border/60 bg-background/95 px-6 py-5 backdrop-blur-sm">
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setSheetGrupoAberto(false)
                  setGrupoEditando(null)
                  setMensagemErro(null)
                }}
              >
                Cancelar
              </Button>
              <div className="flex items-center gap-2">
                {grupoEditando ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setConfirmacaoExclusao({
                        tipo: "grupo",
                        id: grupoEditando.grupoAtual,
                        nome: grupoEditando.grupoAtual,
                      })
                    }
                  >
                    Excluir grupo
                  </Button>
                ) : null}
                <Button
                  className="rounded-md px-8"
                  disabled={renomearGrupoMutation.isPending}
                  onClick={() => void salvarGrupoEditado()}
                >
                  {renomearGrupoMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={Boolean(confirmacaoExclusao)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmacaoExclusao(null)
          }
        }}
        title={
          confirmacaoExclusao?.tipo === "grupo"
            ? "Excluir grupo"
            : "Excluir categoria"
        }
        description={
          confirmacaoExclusao?.tipo === "grupo"
            ? "Essa acao remove o grupo selecionado. Use com cuidado, pois impacta as categorias relacionadas."
            : "Essa acao remove a categoria selecionada. Use com cuidado, pois ela deixara de aparecer nos fluxos de classificacao."
        }
        confirmLabel={
          confirmacaoExclusao?.tipo === "grupo"
            ? excluirGrupoMutation.isPending
              ? "Excluindo..."
              : "Excluir grupo"
            : excluirCategoriaMutation.isPending
              ? "Excluindo..."
              : "Excluir categoria"
        }
        loading={
          confirmacaoExclusao?.tipo === "grupo"
            ? excluirGrupoMutation.isPending
            : excluirCategoriaMutation.isPending
        }
        onConfirm={confirmarExclusao}
      >
        {confirmacaoExclusao ? (
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="font-medium">{confirmacaoExclusao.nome}</p>
          </div>
        ) : null}
      </ConfirmActionDialog>

      {mensagemErro ? (
        <Card className="rounded-md border-destructive/25">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-destructive">
            <span>{mensagemErro}</span>
            <Button onClick={() => setMensagemErro(null)} size="icon" type="button" variant="ghost">
              <IconX className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {metricas.map((metrica) => (
          <Card
            key={metrica.rotulo}
            className={`overflow-hidden rounded-md border-border/60 bg-linear-to-br ${metrica.destaque} shadow-none`}
          >
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="mb-2 text-xs font-medium  tracking-[0.14em] text-muted-foreground">
                  {metrica.rotulo}
                </p>
                <p className="text-4xl font-semibold tracking-tight">{metrica.valor}</p>
              </div>
              <div className="rounded-md bg-white/75 p-3 text-muted-foreground ">
                {metrica.icone}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-md border-violet-200/70 bg-linear-to-r from-violet-50 via-fuchsia-50 to-white shadow-none">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-md bg-violet-500/10 p-3 text-violet-700">
              <IconWand className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Regras de categorizacao</p>
              <p className="text-sm text-muted-foreground">
                Estruture grupos e use campos padrao para organizar o financeiro.
              </p>
            </div>
          </div>
          <IconChevronRight />
        </CardContent>
      </Card>

      <div className="relative">
        <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 rounded-md border-border/70 bg-white pl-10"
          placeholder="Buscar categorias..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border/70 bg-card p-1.5 md:grid-cols-4">
          {[
            {
              id: "DESPESA" as const,
              label: "Despesas",
              icone: <IconTag className="size-4" />,
              total: totaisPorTipo.DESPESA,
            },
            {
              id: "RECEITA" as const,
              label: "Receitas",
              icone: <IconTrendingUp className="size-4" />,
              total: totaisPorTipo.RECEITA,
            },
            {
              id: "TRANSFERENCIA" as const,
              label: "Transf.",
              icone: <IconArrowsExchange className="size-4" />,
              total: totaisPorTipo.TRANSFERENCIA,
            },
            {
              id: "INVESTIMENTO" as const,
              label: "Invest.",
              icone: <IconCoin className="size-4" />,
              total: totaisPorTipo.INVESTIMENTO,
            },
          ].map((filtro) => (
            <Button
              key={filtro.id}
              className={`h-auto justify-between rounded-md px-3 py-2 text-sm transition ${filtroTipo === filtro.id
                ? "bg-foreground text-background "
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              type="button"
              variant="ghost"
              onClick={() => setFiltroTipo(filtro.id)}
            >
              <span className="flex items-center gap-2">
                {filtro.icone}
                {filtro.label}
              </span>
              <span className="text-xs opacity-80">{filtro.total}</span>
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md border border-border/70 bg-card p-1.5">
          {[
            { id: "GRUPOS" as const, label: "Grupos", total: grupos.length },
            { id: "CATEGORIAS" as const, label: "Categorias", total: categoriasFiltradas.length },
          ].map((modo) => (
            <Button
              key={modo.id}
              className={`h-auto rounded-md px-3 py-2 text-sm transition ${modoVisualizacao === modo.id
                ? "bg-muted text-foreground "
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              type="button"
              variant="ghost"
              onClick={() => setModoVisualizacao(modo.id)}
            >
              {modo.label}
              <span className="ml-2 text-xs opacity-75">{modo.total}</span>
            </Button>
          ))}
        </div>
      </div>

      {categoriasQuery.isLoading ? (
        <Card className="rounded-md">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Carregando categorias...
          </CardContent>
        </Card>
      ) : null}

      {categoriasQuery.isError ? (
        <Card className="rounded-md border-destructive/30">
          <CardContent className="p-6 text-sm text-destructive">
            Nao foi possivel carregar as categorias do backend.
          </CardContent>
        </Card>
      ) : null}

      {!categoriasQuery.isLoading &&
        !categoriasQuery.isError &&
        categoriasFiltradas.length === 0 ? (
        <Card className="rounded-md border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="rounded-md bg-muted p-3 text-muted-foreground">
              <IconFolder className="size-6" />
            </div>
            <div>
              <p className="font-medium">Nenhuma categoria encontrada</p>
              <p className="text-sm text-muted-foreground">
                Ajuste a busca, troque o tipo ou crie uma nova categoria.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!categoriasQuery.isLoading &&
        !categoriasQuery.isError &&
        categoriasFiltradas.length > 0 ? (
        modoVisualizacao === "GRUPOS" ? (
          <div className="space-y-3">
            {grupos.map((grupo, indice) => (
              <Collapsible
                key={grupo.id}
                className="rounded-md border border-border/70 bg-card shadow-none"
                defaultOpen={indice < 4}
              >
                <div className="flex items-center justify-between gap-4 px-4 py-4 rounded-md">
                  <CollapsibleTrigger asChild>
                    <Button
                      className="h-auto min-w-0 flex-1 justify-start gap-4 px-0 py-0 text-left"
                      variant="ghost"
                    >
                      <div
                        className={`flex size-12 shrink-0 items-center justify-center rounded-md bg-linear-to-br ${grupo.destaque} text-xl shadow-inner`}
                      >
                        {grupo.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{grupo.titulo}</p>
                          <Badge variant="secondary">{grupo.categorias.length}</Badge>
                          {grupo.oculto ? <Badge variant="outline">Oculto</Badge> : null}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {grupo.descricao}
                        </p>
                      </div>
                    </Button>
                  </CollapsibleTrigger>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="cursor-pointer"
                          type="button"
                          variant="ghost"
                        >
                          <IconDotsVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 min-w-56">
                        <DropdownMenuItem onClick={() => abrirEdicaoGrupo(grupo)}>
                          <IconEdit />
                          Editar grupo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            void atualizarVisibilidadeGrupoMutation.mutateAsync({
                              grupoAtual: grupo.titulo,
                              ocultarRelatorios: !grupo.oculto,
                            })
                          }
                        >
                          {grupo.oculto ? <IconEye /> : <IconEyeOff />}
                          {grupo.oculto ? "Mostrar nos relatorios" : "Ocultar dos relatorios"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            setConfirmacaoExclusao({
                              tipo: "grupo",
                              id: grupo.titulo,
                              nome: grupo.titulo,
                            })
                          }
                        >
                          <IconTrash />
                          Excluir grupo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                      >
                        <IconChevronDown className="size-4 transition group-data-[state=open]:rotate-180" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                <CollapsibleContent className="border-t border-border/60">
                  {grupo.categorias.map((categoria) => (
                    <div
                      key={categoria.id}
                      className="flex items-center justify-between gap-4 border-t border-border/50 px-4 py-4 first:border-t-0"
                    >
                      <Button
                        className="h-auto min-w-0 flex-1 justify-start gap-4 px-0 py-0 text-left"
                        type="button"
                        variant="ghost"
                        onClick={() => abrirEdicao(categoria)}
                      >
                        <div
                          className="flex size-10 items-center justify-center rounded-md border border-white/80 text-lg shadow-inner"
                          style={{
                            background: `linear-gradient(135deg, ${corComFallback(categoria.cor)}25, #ffffff)`,
                          }}
                        >
                          {renderizarIconeCategoria(categoria.icone, "size-5")}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{categoria.nome}</p>
                            {categoria.ocultarRelatorios ? (
                              <Badge variant="outline">Oculta</Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {categoria.tipo === "DESPESA"
                              ? categoria.tipoDespesa === "FIXA"
                                ? "Despesa fixa"
                                : "Despesa variavel"
                              : categoria.tipo.toLowerCase()}
                          </p>
                        </div>
                      </Button>

                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="cursor-pointer"
                              type="button"
                              variant="ghost"
                            >
                              <IconDotsVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 min-w-56">
                            <DropdownMenuItem onClick={() => abrirEdicao(categoria)}>
                              <IconEdit />
                              Editar categoria
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCategoriaEditando(categoria)
                                setFormularioCategoria({
                                  ...mapearCategoriaParaFormulario(categoria),
                                  ocultarRelatorios: !categoria.ocultarRelatorios,
                                })
                                void atualizarCategoriaMutation.mutateAsync({
                                  categoriaId: categoria.id,
                                  payload: {
                                    ...mapearCategoriaParaFormulario(categoria),
                                    ocultarRelatorios: !categoria.ocultarRelatorios,
                                  },
                                })
                              }}
                            >
                              {categoria.ocultarRelatorios ? <IconEye /> : <IconEyeOff />}
                              {categoria.ocultarRelatorios
                                ? "Mostrar nos relatorios"
                                : "Ocultar dos relatorios"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                setConfirmacaoExclusao({
                                  tipo: "categoria",
                                  id: categoria.id,
                                  nome: categoria.nome,
                                })
                              }
                            >
                              <IconTrash />
                              Excluir categoria
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          className="cursor-pointer"
                          type="button"
                          variant="ghost"
                          onClick={() => abrirEdicao(categoria)}
                        >
                          <IconChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categoriasFiltradas.map((categoria) => (
              <Card key={categoria.id} className="rounded-md border-border/70 shadow-none">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <Button
                    className="h-auto min-w-0 flex-1 justify-start gap-3 px-0 py-0 text-left"
                    type="button"
                    variant="ghost"
                    onClick={() => abrirEdicao(categoria)}
                  >
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-md border border-white/80 text-lg shadow-inner"
                      style={{
                        background: `linear-gradient(135deg, ${corComFallback(categoria.cor)}25, #ffffff)`,
                      }}
                    >
                      {renderizarIconeCategoria(categoria.icone, "size-5")}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{categoria.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{categoria.grupo}</p>
                    </div>
                  </Button>
                  <Badge variant="outline">{categoria.tipo.toLowerCase()}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}
