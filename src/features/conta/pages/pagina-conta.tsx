import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  IconBrandTelegram,
  IconCopy,
  IconPlugConnected,
  IconShieldLock,
} from "@tabler/icons-react"

import {
  consultarStatusTelegramApi,
  desvincularTelegramApi,
  gerarTokenTelegramApi,
} from "@/features/telegram/api/telegram-api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { extrairMensagemErroApi } from "@/shared/lib/api-error"
import { formatarData } from "@/shared/lib/formatadores"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"

export function PaginaConta() {
  const queryClient = useQueryClient()
  const [confirmacaoDesvincularAberta, setConfirmacaoDesvincularAberta] = React.useState(false)
  const statusTelegramQuery = useQuery({
    queryKey: ["telegram-status"],
    queryFn: consultarStatusTelegramApi,
  })
  const gerarTokenMutation = useMutation({
    mutationFn: gerarTokenTelegramApi,
  })
  const desvincularMutation = useMutation({
    mutationFn: desvincularTelegramApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["telegram-status"] })
    },
  })

  const status = statusTelegramQuery.data
  const tokenAtual = gerarTokenMutation.data ?? status?.tokenConexao ?? null

  async function copiarToken() {
    if (!tokenAtual) {
      return
    }

    await navigator.clipboard.writeText(tokenAtual.token)
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Conta"
        descricao="Gerencie as informacoes da sua conta, preferências de segurança e conexoes."
      />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconBrandTelegram className="size-4 text-primary" />
              <CardTitle>Conectar Telegram</CardTitle>
            </div>
            <CardDescription>
              Gere um codigo temporario e envie para o bot para vincular sua conta com seguranca.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status?.vinculado ? "success" : "secondary"}>
                {status?.vinculado ? "Vinculado" : "Nao vinculado"}
              </Badge>
              <Badge variant={status?.sessaoAtiva ? "success" : "warning"}>
                {status?.sessaoAtiva ? "Sessao ativa" : "Sessao inativa"}
              </Badge>
            </div>

            <div className="rounded-md border border-border/70 p-4">
              <p className="text-sm font-medium">Fluxo seguro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                1. Gere um codigo temporario autenticado no app.
              </p>
              <p className="text-sm text-muted-foreground">
                2. Envie ao bot o comando <span className="font-mono">/conectar CODIGO</span>.
              </p>
              <p className="text-sm text-muted-foreground">
                3. O backend valida o token, vincula o Telegram e abre a sessao.
              </p>
            </div>

            {tokenAtual ? (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Codigo de conexao
                    </p>
                    <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.3em]">
                      {tokenAtual.token}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copiarToken()}>
                    <IconCopy />
                    Copiar token
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Expira em {formatarData(tokenAtual.expiraEm)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Comando: <span className="font-mono">{tokenAtual.comando}</span>
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void gerarTokenMutation.mutateAsync(false)}
                disabled={gerarTokenMutation.isPending}
              >
                <IconPlugConnected />
                {gerarTokenMutation.isPending
                  ? "Gerando codigo..."
                  : tokenAtual
                    ? "Reutilizar token atual"
                    : "Gerar codigo de conexao"}
              </Button>
              {tokenAtual ? (
                <Button
                  variant="outline"
                  onClick={() => void gerarTokenMutation.mutateAsync(true)}
                  disabled={gerarTokenMutation.isPending}
                >
                  Gerar novo token
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => setConfirmacaoDesvincularAberta(true)}
                disabled={!status?.vinculado || desvincularMutation.isPending}
              >
                Desvincular Telegram
              </Button>
            </div>

            {gerarTokenMutation.isError ? (
              <p className="text-sm text-destructive">
                {extrairMensagemErroApi(
                  gerarTokenMutation.error,
                  "Nao foi possivel gerar o codigo do Telegram."
                )}
              </p>
            ) : null}

            {desvincularMutation.isError ? (
              <p className="text-sm text-destructive">
                {extrairMensagemErroApi(
                  desvincularMutation.error,
                  "Nao foi possivel desvincular o Telegram."
                )}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconShieldLock className="size-4 text-primary" />
              <CardTitle>Estado atual</CardTitle>
            </div>
            <CardDescription>
              Resumo do vinculo e da sessao protegida do Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusTelegramQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Carregando estado do Telegram...
              </p>
            ) : null}
            {statusTelegramQuery.isError ? (
              <p className="text-sm text-destructive">
                {extrairMensagemErroApi(
                  statusTelegramQuery.error,
                  "Nao foi possivel consultar o status do Telegram."
                )}
              </p>
            ) : null}
            {status ? (
              <>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Bot</p>
                  <p className="text-sm font-medium">
                    {status.botUsername ? `@${status.botUsername}` : "Nao configurado"}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Chat vinculado</p>
                  <p className="text-sm font-medium">
                    {status.telegramChatIdMascarado ?? "Nenhum"}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Usuario Telegram</p>
                  <p className="text-sm font-medium">
                    {status.telegramUserIdMascarado ?? "Nenhum"}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Sessao expira em</p>
                  <p className="text-sm font-medium">
                    {status.sessaoExpiraEm
                      ? formatarData(status.sessaoExpiraEm)
                      : "Sem sessao ativa"}
                  </p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <ConfirmActionDialog
        open={confirmacaoDesvincularAberta}
        onOpenChange={setConfirmacaoDesvincularAberta}
        title="Desvincular Telegram"
        description="Essa acao encerra o vinculo atual com o Telegram e remove a sessao ativa."
        confirmLabel={desvincularMutation.isPending ? "Desvinculando..." : "Desvincular"}
        loading={desvincularMutation.isPending}
        onConfirm={async () => {
          await desvincularMutation.mutateAsync()
          setConfirmacaoDesvincularAberta(false)
        }}
      />
    </div>
  )
}
