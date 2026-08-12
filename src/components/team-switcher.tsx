"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconPlus,
  IconTrash,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react"

import { usePerfilFinanceiro } from "@/app/perfil-financeiro"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { Button } from "@/components/ui/button"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function obterIniciaisPerfil(nome?: string | null) {
  if (!nome) {
    return "KF"
  }

  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("")
}

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const {
    carregando,
    criando,
    excluindo,
    perfis,
    perfilAtivo,
    selecionarPerfil,
    criarPerfil,
    excluirPerfil,
  } =
    usePerfilFinanceiro()
  const [dialogAberto, setDialogAberto] = React.useState(false)
  const [confirmacaoExclusaoAberta, setConfirmacaoExclusaoAberta] =
    React.useState(false)
  const [perfilPendenteExclusaoId, setPerfilPendenteExclusaoId] =
    React.useState<string | null>(null)
  const [nomeNovoPerfil, setNomeNovoPerfil] = React.useState("")
  const [erroCriacao, setErroCriacao] = React.useState("")

  const tituloPerfil = perfilAtivo?.nome ?? "Perfil financeiro"
  const subtituloPerfil = perfilAtivo?.padrao
    ? "Perfil principal"
    : "Perfil adicional"
  const perfilPendenteExclusao =
    perfis.find((perfil) => perfil.id === perfilPendenteExclusaoId) ?? null

  const criarNovoPerfil = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErroCriacao("")

    try {
      await criarPerfil(nomeNovoPerfil)
      setNomeNovoPerfil("")
      setDialogAberto(false)
    } catch {
      setErroCriacao("Nao foi possivel criar o novo perfil agora.")
    }
  }

  const confirmarExclusaoPerfil = async () => {
    if (!perfilPendenteExclusao) {
      return
    }

    await excluirPerfil(perfilPendenteExclusao.id)
    setConfirmacaoExclusaoAberta(false)
    setPerfilPendenteExclusaoId(null)
  }

  return (
    <>
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                    {carregando ? (
                      <IconUsers className="size-4" />
                    ) : (
                      <span className="text-xs font-semibold">
                        {obterIniciaisPerfil(tituloPerfil)}
                      </span>
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{tituloPerfil}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {carregando ? "Carregando perfis..." : subtituloPerfil}
                    </span>
                  </div>
                  <IconChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-md"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Perfis financeiros
                </DropdownMenuLabel>
                {perfis.length === 0 ? (
                  <DropdownMenuItem disabled className="gap-2 p-2">
                    <IconUserCircle className="size-4" />
                    Nenhum perfil disponivel
                  </DropdownMenuItem>
                ) : null}
                {perfis.map((perfil) => (
                  <div key={perfil.id} className="flex items-center gap-1 rounded-md px-1 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto flex-1 justify-start px-2 py-2"
                      onClick={() => void selecionarPerfil(perfil.id)}
                    >
                      <div className="flex w-full items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-md border border-sidebar-border bg-background text-[10px] font-semibold">
                          {obterIniciaisPerfil(perfil.nome)}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col text-left">
                          <span className="truncate text-sm">{perfil.nome}</span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {perfil.padrao ? "Perfil principal" : "Perfil adicional"}
                          </span>
                        </div>
                        {perfilAtivo?.id === perfil.id ? (
                          <span className="text-[11px] text-primary">Ativo</span>
                        ) : null}
                      </div>
                    </Button>
                    {!perfil.padrao ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setPerfilPendenteExclusaoId(perfil.id)
                          setConfirmacaoExclusaoAberta(true)
                        }}
                      >
                        <IconTrash className="size-4" />
                        <span className="sr-only">Excluir perfil</span>
                      </Button>
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={() => {
                    setErroCriacao("")
                    setDialogAberto(true)
                  }}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <IconPlus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Novo perfil</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo perfil</DialogTitle>
            <DialogDescription>
              Crie um perfil financeiro separado para outra pessoa ou outro contexto da mesma assinatura.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void criarNovoPerfil(event)}>
            <div className="space-y-2">
              <Label htmlFor="nome-perfil-financeiro">Nome do perfil</Label>
              <Input
                id="nome-perfil-financeiro"
                placeholder="Ex.: Felipe"
                value={nomeNovoPerfil}
                onChange={(event) => setNomeNovoPerfil(event.target.value)}
              />
              {erroCriacao ? (
                <p className="text-xs text-destructive">{erroCriacao}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogAberto(false)
                  setErroCriacao("")
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={criando}>
                {criando ? "Criando..." : "Criar perfil"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmacaoExclusaoAberta}
        onOpenChange={(aberto) => {
          setConfirmacaoExclusaoAberta(aberto)
          if (!aberto) {
            setPerfilPendenteExclusaoId(null)
          }
        }}
        title="Excluir perfil financeiro"
        description={
          perfilPendenteExclusao
            ? `Voce esta prestes a excluir o perfil ${perfilPendenteExclusao.nome}. As contas, categorias e transacoes desse perfil tambem serao removidas da visao do sistema.`
            : "Confirme a exclusao deste perfil financeiro."
        }
        confirmLabel="Excluir perfil"
        loading={excluindo}
        onConfirm={() => void confirmarExclusaoPerfil()}
      />
    </>
  )
}
