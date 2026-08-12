import * as React from "react"
import { useAuth } from "@/app/auth"
import { IconBellRinging, IconPalette, IconWorld } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { dadosIniciais } from "@/shared/lib/dados-mock"
import { formatarMoeda, obterSimboloMoeda } from "@/shared/lib/formatadores"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"

const opcoesMoeda = [
  { valor: "BRL", rotulo: "Real brasileiro (BRL)" },
  { valor: "USD", rotulo: "Dolar americano (USD)" },
  { valor: "EUR", rotulo: "Euro (EUR)" },
  { valor: "GBP", rotulo: "Libra esterlin (GBP)" },
  { valor: "ARS", rotulo: "Peso argentino (ARS)" },
] as const

const opcoesFusoHorario = [
  { valor: "America/Sao_Paulo", rotulo: "America/Sao_Paulo" },
  { valor: "America/New_York", rotulo: "America/New_York" },
  { valor: "Europe/Lisbon", rotulo: "Europe/Lisbon" },
  { valor: "Europe/Madrid", rotulo: "Europe/Madrid" },
  { valor: "Europe/Berlin", rotulo: "Europe/Berlin" },
] as const

export function PaginaConfiguracoes() {
  const { nome, email, moeda, fusoHorario, atualizarPreferencias } = useAuth()
  const [moedaSelecionada, setMoedaSelecionada] = React.useState(moeda)
  const [fusoSelecionado, setFusoSelecionado] = React.useState(fusoHorario)
  const [salvando, setSalvando] = React.useState(false)
  const [mensagemSucesso, setMensagemSucesso] = React.useState("")
  const [mensagemErro, setMensagemErro] = React.useState("")

  const exemplosMoeda = [129.9, 1840.45, 12650]
  const simboloMoeda = obterSimboloMoeda(moedaSelecionada)

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Configuracoes"
        descricao="Preferencias de moeda, idioma, tema e notificacoes."
      />

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconWorld className="size-4 text-primary" />
              <CardTitle>Regionalizacao</CardTitle>
            </div>
            <CardDescription>
              Configuracoes basicas de moeda e fuso horario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="mb-1 text-xs font-medium">Nome</Label>
              <Input
                defaultValue={nome ?? dadosIniciais.usuario.nome}
                readOnly
              />
            </div>
            <div>
              <Label className="mb-1 text-xs font-medium">Email</Label>
              <Input
                defaultValue={email ?? dadosIniciais.usuario.email}
                readOnly
              />
            </div>
            <div>
              <Label className="mb-1 text-xs font-medium">Moeda</Label>
              <Select
                value={moedaSelecionada}
                onValueChange={setMoedaSelecionada}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a moeda" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesMoeda.map((opcao) => (
                    <SelectItem key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-xs font-medium">Fuso horario</Label>
              <Select
                value={fusoSelecionado}
                onValueChange={setFusoSelecionado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fuso horario" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesFusoHorario.map((opcao) => (
                    <SelectItem key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/15 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Pre-visualizacao da moeda
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O dashboard e os formularios passam a exibir os valores
                    neste formato.
                  </p>
                </div>
                <Badge variant="secondary">{simboloMoeda}</Badge>
              </div>
              <div className="mt-4 grid gap-2">
                {exemplosMoeda.map((valor) => (
                  <div
                    key={valor}
                    className="flex items-center justify-between rounded-md border border-border/50 bg-background/70 px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">
                      Exemplo
                    </span>
                    <span className="text-sm font-medium">
                      {formatarMoeda(valor, moedaSelecionada)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Button
                disabled={salvando}
                onClick={async () => {
                  setSalvando(true)
                  setMensagemErro("")
                  setMensagemSucesso("")

                  try {
                    await atualizarPreferencias({
                      moeda: moedaSelecionada,
                      fusoHorario: fusoSelecionado,
                    })
                    setMensagemSucesso("Preferencias atualizadas com sucesso.")
                  } catch {
                    setMensagemErro(
                      "Nao foi possivel salvar suas preferencias agora."
                    )
                  } finally {
                    setSalvando(false)
                  }
                }}
              >
                {salvando ? "Salvando..." : "Salvar preferencias"}
              </Button>
            </div>
            {mensagemSucesso ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {mensagemSucesso}
              </p>
            ) : null}
            {mensagemErro ? (
              <p className="text-sm text-destructive">{mensagemErro}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconPalette className="size-4 text-primary" />
              <CardTitle>Tema</CardTitle>
            </div>
            <CardDescription>
              O modo claro, escuro e sistema segue a configuracao global.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="secondary">Persistencia ativa</Badge>
            <p className="text-xs text-muted-foreground">
              O atalho de teclado com a tecla D continua habilitado.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconBellRinging className="size-4 text-primary" />
              <CardTitle>Notificacoes</CardTitle>
            </div>
            <CardDescription>
              Resumos, alertas de budget e vencimento de fatura.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="success">Resumo semanal ativo</Badge>
            <Badge variant="warning">Alerta de fatura ativo</Badge>
            <Button variant="outline" className="w-full">
              Configurar notificacoes
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
