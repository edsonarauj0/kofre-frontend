import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { IconBuildingBank, IconChevronRight, IconCreditCard, IconPlus, IconTrash } from "@tabler/icons-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { Link } from "react-router-dom"
import { z } from "zod"

import { useAuth } from "@/app/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  SheetTrigger,
} from "@/components/ui/sheet"
import { LogoBanco } from "@/shared/components/logo-banco"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"
import { bancosDisponiveis } from "@/shared/lib/bancos"
import {
  formatarMoeda,
  obterSimboloMoeda,
  parseValorDigitado,
} from "@/shared/lib/formatadores"
import type { Conta } from "@/shared/types/financeiro"

import { criarContaApi, excluirContaApi, listarContasApi } from "@/features/contas/api/contas-api"

const schemaConta = z.object({
  nome: z.string().min(2, "Informe o nome da conta"),
  tipo: z.enum(["CORRENTE", "POUPANCA", "INVESTIMENTO", "CARTEIRA", "CRIPTO"]),
  instituicao: z.string().min(2, "Informe a instituição"),
  saldoAtual: z
    .string()
    .min(1, "Informe o saldo inicial")
    .refine(
      (valor) => Number.isFinite(parseValorDigitado(valor)),
      "Informe um saldo inicial válido"
    ),
})

type FormularioConta = z.infer<typeof schemaConta>

const rotuloBadgeTipo: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  carteira: "Carteira",
  cartao_credito: "Cartão",
  cripto: "Cripto",
}

function corSaldo(saldo: number) {
  return saldo < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
}

function agruparContasPorInstituicao(contas: Conta[]) {
  return Object.entries(
    contas.reduce<Record<string, Conta[]>>((grupos, conta) => {
      const chave = conta.instituicao || "Outras instituições"
      grupos[chave] ??= []
      grupos[chave].push(conta)
      return grupos
    }, {})
  ).sort((a, b) => {
    const totalA = a[1].reduce((total, conta) => total + conta.saldoAtual, 0)
    const totalB = b[1].reduce((total, conta) => total + conta.saldoAtual, 0)
    return totalB - totalA
  })
}

export function PaginaContas() {
  const { moeda } = useAuth()
  const queryClient = useQueryClient()
  const [sheetAberta, setSheetAberta] = React.useState(false)
  const [mensagemSucesso, setMensagemSucesso] = React.useState("")
  const [mensagemErro, setMensagemErro] = React.useState("")

  const contasQuery = useQuery({
    queryKey: ["contas"],
    queryFn: listarContasApi,
  })

  const contas = contasQuery.data ?? []
  const contasComuns = contas.filter((conta) => conta.tipo !== "cartao_credito")
  const cartoes = contas.filter((conta) => conta.tipo === "cartao_credito")

  const saldoTotal = contasComuns.reduce((total, conta) => total + conta.saldoAtual, 0)
  const instituicoesAtivas = new Set(contasComuns.map((conta) => conta.instituicao)).size
  const contasNegativas = contasComuns.filter((conta) => conta.saldoAtual < 0).length
  const gruposPorInstituicao = agruparContasPorInstituicao(contasComuns)

  const criarContaMutation = useMutation({
    mutationFn: criarContaApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
      reset({
        nome: "",
        tipo: "CORRENTE",
        instituicao: bancosDisponiveis[0]?.nome ?? "Nubank",
        saldoAtual: "0",
      })
      setMensagemErro("")
      setMensagemSucesso("Conta criada com sucesso.")
      setTimeout(() => setSheetAberta(false), 800)
    },
    onError: () => {
      setMensagemSucesso("")
      setMensagemErro("Não foi possível criar a conta.")
    },
  })

  const excluirContaMutation = useMutation({
    mutationFn: excluirContaApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contas"] })
    },
  })

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormularioConta>({
    resolver: zodResolver(schemaConta),
    defaultValues: {
      nome: "",
      tipo: "CORRENTE",
      instituicao: bancosDisponiveis[0]?.nome ?? "Nubank",
      saldoAtual: "0",
    },
  })

  function limparSheet() {
    reset({
      nome: "",
      tipo: "CORRENTE",
      instituicao: bancosDisponiveis[0]?.nome ?? "Nubank",
      saldoAtual: "0",
    })
    setMensagemSucesso("")
    setMensagemErro("")
  }

  async function onSubmit(valores: FormularioConta) {
    setMensagemErro("")
    setMensagemSucesso("")
    await criarContaMutation.mutateAsync({
      nome: valores.nome,
      tipo: valores.tipo,
      instituicao: valores.instituicao,
      saldoAtual: parseValorDigitado(valores.saldoAtual),
    })
  }

  function confirmarExclusao(conta: Conta) {
    if (
      window.confirm(
        `Excluir "${conta.nome}"? Todas as transações vinculadas perderão a referência a esta conta.`
      )
    ) {
      excluirContaMutation.mutate(conta.id)
    }
  }

  return (
    <div className="space-y-8">
      <CabecalhoPagina
        titulo="Contas"
        descricao="Gerencie suas contas bancárias conectadas e manuais em uma área dedicada."
        acoes={
          <>
            <Button asChild size="lg" variant="outline">
              <Link to="/cartoes">
                <IconCreditCard />
                Ver cartões
              </Link>
            </Button>
            <Sheet
              open={sheetAberta}
              onOpenChange={(open) => {
                setSheetAberta(open)
                if (!open) {
                  limparSheet()
                }
              }}
            >
              <SheetTrigger asChild>
                <Button size="lg">
                  <IconPlus />
                  Nova conta
                </Button>
              </SheetTrigger>
              <SheetContent className="flex h-full w-full flex-col overflow-hidden sm:max-w-md">
                <SheetHeader className="shrink-0">
                  <SheetTitle>Nova conta</SheetTitle>
                  <SheetDescription>
                    Cadastre uma conta corrente, poupança, investimento, carteira ou cripto.
                  </SheetDescription>
                </SheetHeader>
                <form className="flex-1 space-y-5 overflow-y-auto p-6" onSubmit={handleSubmit(onSubmit)}>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nome</Label>
                    <Input placeholder="Ex: Conta principal" {...register("nome")} />
                    {errors.nome ? <p className="text-xs text-destructive">{errors.nome.message}</p> : null}
                  </div>

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
                            <SelectItem value="CORRENTE">Corrente</SelectItem>
                            <SelectItem value="POUPANCA">Poupança</SelectItem>
                            <SelectItem value="INVESTIMENTO">Investimento</SelectItem>
                            <SelectItem value="CARTEIRA">Carteira</SelectItem>
                            <SelectItem value="CRIPTO">Cripto</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.tipo ? <p className="text-xs text-destructive">{errors.tipo.message}</p> : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Instituição</Label>
                    <Controller
                      control={control}
                      name="instituicao"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a instituição" />
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
                    {errors.instituicao ? (
                      <p className="text-xs text-destructive">{errors.instituicao.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Saldo inicial em {moeda}</Label>
                    <Controller
                      control={control}
                      name="saldoAtual"
                      render={({ field }) => (
                        <CurrencyInput
                          allowNegative
                          placeholder={`${obterSimboloMoeda(moeda)} 0,00`}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                    {errors.saldoAtual ? (
                      <p className="text-xs text-destructive">{errors.saldoAtual.message}</p>
                    ) : null}
                  </div>

                  {mensagemSucesso ? (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{mensagemSucesso}</p>
                  ) : null}
                  {mensagemErro ? <p className="text-sm text-destructive">{mensagemErro}</p> : null}

                  <Button className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Salvando..." : "Criar conta"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardDescription>Saldo total disponível</CardDescription>
            <CardTitle className={saldoTotal < 0 ? "text-destructive" : ""}>
              {formatarMoeda(saldoTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Soma consolidada das contas bancárias e carteiras.
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardDescription>Contas monitoradas</CardDescription>
            <CardTitle>{contasComuns.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {contasNegativas > 0
              ? `${contasNegativas} conta(s) pedem atenção por saldo negativo.`
              : "Nenhuma conta com saldo negativo no momento."}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardDescription>Instituições ativas</CardDescription>
            <CardTitle>{instituicoesAtivas}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Distribuição bancária atual das suas contas cadastradas.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Mapa de contas</CardTitle>
            <CardDescription>
              Visualize seus saldos agrupados por instituição para navegar melhor entre contas conectadas e manuais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contasQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando contas...</p>
            ) : contasQuery.isError ? (
              <p className="text-sm text-destructive">Não foi possível carregar as contas do backend.</p>
            ) : contasComuns.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                Nenhuma conta cadastrada ainda. Use o botão “Nova conta” para começar.
              </div>
            ) : (
              gruposPorInstituicao.map(([instituicao, contasInstituicao]) => {
                const totalInstituicao = contasInstituicao.reduce(
                  (total, conta) => total + conta.saldoAtual,
                  0
                )

                return (
                  <div key={instituicao} className="rounded-md border border-border/70 bg-card/60">
                    <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <LogoBanco instituicao={instituicao} tamanho="lg" />
                        <div>
                          <p className="text-sm font-semibold">{instituicao}</p>
                          <p className="text-xs text-muted-foreground">
                            {contasInstituicao.length} conta(s) nesta instituição
                          </p>
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-xs  tracking-[0.2em] text-muted-foreground">Total</p>
                        <p className={`text-lg font-semibold ${corSaldo(totalInstituicao)}`}>
                          {formatarMoeda(totalInstituicao)}
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-border/60">
                      {contasInstituicao.map((conta) => (
                        <div
                          key={conta.id}
                          className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{conta.nome}</p>
                              <Badge variant="secondary">{rotuloBadgeTipo[conta.tipo] ?? conta.tipo}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Conta dedicada a acompanhar o saldo real dessa origem.
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-base font-semibold ${corSaldo(conta.saldoAtual)}`}>
                                {formatarMoeda(conta.saldoAtual)}
                              </p>
                              <p className="text-xs text-muted-foreground">Saldo atual</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={excluirContaMutation.isPending}
                              onClick={() => confirmarExclusao(conta)}
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBuildingBank className="size-5 text-primary" />
                Distribuição por tipo
              </CardTitle>
              <CardDescription>Leitura rápida da composição atual das suas contas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(rotuloBadgeTipo)
                .filter(([tipo]) => tipo !== "cartao_credito")
                .map(([tipo, rotulo]) => {
                  const quantidade = contasComuns.filter((conta) => conta.tipo === tipo).length
                  if (quantidade === 0) return null

                  return (
                    <div key={tipo} className="flex items-center justify-between rounded-md border border-border/70 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{rotulo}</p>
                        <p className="text-xs text-muted-foreground">Tipo de conta cadastrado</p>
                      </div>
                      <Badge variant="outline">{quantidade}</Badge>
                    </div>
                  )
                })}

              {contasComuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  A distribuição aparece assim que a primeira conta for cadastrada.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCreditCard className="size-5 text-primary" />
                Área de cartões
              </CardTitle>
              <CardDescription>
                Seus cartões agora vivem em uma tela própria com visão de fatura, parcelas e projeção.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border/70 bg-muted/30 p-4">
                <p className="text-2xl font-semibold">{cartoes.length}</p>
                <p className="text-sm text-muted-foreground">cartão(ões) cadastrados</p>
              </div>

              <Button asChild className="w-full">
                <Link to="/cartoes">
                  Abrir cartões
                  <IconChevronRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
