"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate } from "react-router-dom"
import {
  IconBrain,
  IconChevronRight,
  IconBuildingBank,
  IconCalendarMonth,
  IconChartDonut3,
  IconCreditCard,
  IconFlag3,
  IconLayoutDashboard,
  IconReceipt2,
  IconSettings,
  IconTargetArrow,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { useAuth } from "@/app/auth"
import { listarContasApi } from "@/features/contas/api/contas-api"
import { BuscaGlobalTransacoes } from "@/features/transacoes/components/transacao-explorer"
import { listarCategoriasApi, listarTransacoesApi } from "@/features/transacoes/api/transacoes-api"
import { cn } from "@/lib/utils"
import { LogoBanco } from "@/shared/components/logo-banco"
import { formatarMoeda } from "@/shared/lib/formatadores"
import type { Conta, Transacao } from "@/shared/types/financeiro"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { dadosIniciais } from "@/shared/lib/dados-mock"
import { NavPlanejamento } from "./nav-planejamento"

type ResumoSidebarItem = {
  id: string
  nome: string
  instituicao: string
  valor: number
  rota: string
}

function obterDataLocal(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

function criarChavePeriodo(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
}

function calcularReferenciaFaturaCartao(
  dataLancamento: string,
  diaFechamento?: number | null
) {
  const data = obterDataLocal(dataLancamento)

  if (!diaFechamento) {
    return criarChavePeriodo(new Date(data.getFullYear(), data.getMonth(), 1))
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

  return `${anoFatura}-${String(mesFatura).padStart(2, "0")}`
}

function formatarRotuloPeriodo(chave: string) {
  const [anoTexto, mesTexto] = chave.split("-")
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)

  if (!ano || !mes) {
    return chave
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  })
    .format(new Date(ano, mes - 1, 1))
    .replace(".", "")
}

function obterValorMovimentacaoConta(transacoes: Transacao[], contaId: string, periodo: string) {
  return transacoes
    .filter((transacao) => transacao.contaId === contaId)
    .filter((transacao) => transacao.tipo !== "transferencia")
    .filter((transacao) => criarChavePeriodo(obterDataLocal(transacao.data)) === periodo)
    .reduce((total, transacao) => {
      return total + (transacao.tipo === "receita" ? transacao.valor : -transacao.valor)
    }, 0)
}

function obterValorFaturaCartao(
  transacoes: Transacao[],
  cartao: Conta,
  periodo: string
) {
  return transacoes
    .filter((transacao) => transacao.contaId === cartao.id)
    .filter((transacao) => transacao.tipo === "despesa")
    .filter(
      (transacao) => calcularReferenciaFaturaCartao(transacao.data, cartao.diaFechamento) === periodo
    )
    .reduce((total, transacao) => total + transacao.valor, 0)
}

function ResumoSidebarGrupo({
  titulo,
  subtitulo,
  icone,
  total,
  itens,
  onAbrirGrupo,
  onAbrirItem,
  moeda,
}: {
  titulo: string
  subtitulo: string
  icone: React.ReactNode
  total: number
  itens: ResumoSidebarItem[]
  onAbrirGrupo: () => void
  onAbrirItem: (item: ResumoSidebarItem) => void
  moeda: string
}) {
  return (
    <Collapsible defaultOpen className="group/collapsible overflow-hidden rounded-xl border border-sidebar-border/70 bg-sidebar-accent/10">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-sidebar-accent/35"
          onDoubleClick={onAbrirGrupo}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-sidebar-foreground/75 text-[8px]">{icone}</span>
            <span className="truncate text-sm text-sidebar-foreground">{titulo}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-sidebar-foreground tabular-nums">
              {formatarMoeda(total, moeda)}
            </span>
            <IconChevronRight className="size-4 text-sidebar-foreground/55 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-sidebar-border/60 px-2 pb-2 pt-1.5">
        <button
          type="button"
          className="px-2 pb-2 text-left text-[11px] text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground/80"
          onClick={onAbrirGrupo}
        >
          {subtitulo}
        </button>
        <div className="space-y-1">
          {itens.length === 0 ? (
            <div className="rounded-lg border border-dashed border-sidebar-border/70 px-3 py-3 text-xs text-sidebar-foreground/60">
              Nenhum valor encontrado neste periodo.
            </div>
          ) : (
            itens.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/40"
                onClick={() => onAbrirItem(item)}
              >
                <LogoBanco instituicao={item.instituicao} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-sidebar-foreground">{item.nome}</p>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    item.valor < 0 ? "text-rose-400" : "text-sidebar-foreground"
                  )}
                >
                  {formatarMoeda(item.valor, moeda)}
                </span>
              </button>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { email, nome, moeda = "BRL" } = useAuth()
  const [periodoSelecionado, setPeriodoSelecionado] = React.useState(() =>
    criarChavePeriodo(new Date())
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
    queryKey: ["transacoes", "sidebar-resumo", contasQuery.data, categoriasQuery.data],
    queryFn: () => listarTransacoesApi(categoriasQuery.data ?? [], contasQuery.data ?? []),
    enabled: Boolean(contasQuery.data && categoriasQuery.data),
  })

  const contas = contasQuery.data ?? []
  const transacoes = transacoesQuery.data ?? []

  const opcoesPeriodo = React.useMemo(() => {
    const chaves = new Set<string>([criarChavePeriodo(new Date())])

    transacoes.forEach((transacao) => {
      const conta = contas.find((item) => item.id === transacao.contaId)
      if (conta?.tipo === "cartao_credito") {
        chaves.add(calcularReferenciaFaturaCartao(transacao.data, conta.diaFechamento))
        return
      }

      chaves.add(criarChavePeriodo(obterDataLocal(transacao.data)))
    })

    return Array.from(chaves)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 24)
      .map((chave) => ({
        chave,
        rotulo: formatarRotuloPeriodo(chave),
      }))
  }, [contas, transacoes])

  React.useEffect(() => {
    if (opcoesPeriodo.length === 0) {
      return
    }

    if (opcoesPeriodo.some((opcao) => opcao.chave === periodoSelecionado)) {
      return
    }

    setPeriodoSelecionado(opcoesPeriodo[0].chave)
  }, [opcoesPeriodo, periodoSelecionado])

  const cartoesResumo = React.useMemo(() => {
    return contas
      .filter((conta) => conta.tipo === "cartao_credito")
      .map((conta) => ({
        id: conta.id,
        nome: conta.nome,
        instituicao: conta.instituicao,
        valor: obterValorFaturaCartao(transacoes, conta, periodoSelecionado),
        rota: "/cartoes",
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [contas, periodoSelecionado, transacoes])

  const contasBancariasResumo = React.useMemo(() => {
    return contas
      .filter((conta) => ["corrente", "poupanca", "carteira"].includes(conta.tipo))
      .map((conta) => ({
        id: conta.id,
        nome: conta.nome,
        instituicao: conta.instituicao,
        valor: obterValorMovimentacaoConta(transacoes, conta.id, periodoSelecionado),
        rota: "/contas",
      }))
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
  }, [contas, periodoSelecionado, transacoes])

  const totalCartoesResumo = cartoesResumo.reduce((total, item) => total + item.valor, 0)
  const totalContasResumo = contasBancariasResumo.reduce((total, item) => total + item.valor, 0)

  const data = {
    user: {
      name: nome ?? dadosIniciais.usuario.nome,
      email: email ?? dadosIniciais.usuario.email,
      avatar: dadosIniciais.usuario.avatar,
    },
    navMain: [
      {
        title: "Dashboard",
        url: "/",
        icon: <IconLayoutDashboard />,
        isActive: pathname === "/",
      },
      {
        title: "Transações",
        url: "/transacoes",
        icon: <IconReceipt2 />,
        isActive: pathname === "/transacoes",
      },
      {
        title: "Agenda financeira",
        url: "/agenda-financeira",
        icon: <IconCalendarMonth />,
        isActive: pathname === "/agenda-financeira",
      },
      {
        title: "Contas",
        url: "/contas",
        icon: <IconBuildingBank />,
        isActive: pathname.startsWith("/contas"),
      },
      {
        title: "Cartões",
        url: "/cartoes",
        icon: <IconCreditCard />,
        isActive: pathname.startsWith("/cartoes"),
      },
      {
        title: "Orçamentos",
        url: "/orcamentos",
        icon: <IconFlag3 />,
        isActive: pathname === "/orcamentos",
      },
      {
        title: "Metas",
        url: "/metas",
        icon: <IconTargetArrow />,
        isActive: pathname === "/metas",
      },
      {
        title: "IA financeira",
        url: "/ia",
        icon: <IconBrain />,
        isActive: pathname === "/ia",
      },
      {
        title: "Configurações",
        url: "/configuracoes",
        icon: <IconSettings />,
        isActive: pathname === "/configuracoes",
      },
    ],
    projects: [
      {
        name: "Fluxo do mes",
        url: "/",
        icon: <IconChartDonut3 />,
      },
      {
        name: "Planejamento",
        url: "/orcamentos",
        icon: <IconFlag3 />,
      },
      {
        name: "Objetivos",
        url: "/metas",
        icon: <IconTargetArrow />,
      },
    ],
    planejamento: [
      {
        name: "Agenda financeira",
        url: "/agenda-financeira",
        icon: <IconCalendarMonth />,
      },
      {
        name: "Categorias",
        url: "/categorias",
        icon: <IconFlag3 />,
      }
    ]
  }

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
        <BuscaGlobalTransacoes />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavPlanejamento planejamento={data.planejamento} />
        <NavProjects projects={data.projects} />
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Minhas contas</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-3 px-2">
            <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
              <SelectTrigger className="h-8 rounded-lg border-sidebar-border/80 bg-sidebar-accent/20 text-xs text-sidebar-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <IconCalendarMonth className="size-3.5 text-sidebar-foreground/65" />
                  <SelectValue placeholder="Periodo" />
                </div>
              </SelectTrigger>
              <SelectContent align="start" className="min-w-[12rem]">
                {opcoesPeriodo.map((opcao) => (
                  <SelectItem key={opcao.chave} value={opcao.chave}>
                    {opcao.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ResumoSidebarGrupo
              titulo="Cartão"
              subtitulo="Faturas do periodo"
              icone={<IconCreditCard className="size-4" />}
              total={totalCartoesResumo}
              itens={cartoesResumo}
              moeda={moeda}
              onAbrirGrupo={() => navigate("/cartoes")}
              onAbrirItem={(item) => navigate(item.rota)}
            />

            <ResumoSidebarGrupo
              titulo="Conta"
              subtitulo="Movimentacao liquida"
              icone={<IconBuildingBank className="size-4" />}
              total={totalContasResumo}
              itens={contasBancariasResumo}
              moeda={moeda}
              onAbrirGrupo={() => navigate("/contas")}
              onAbrirItem={(item) => navigate(item.rota)}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
