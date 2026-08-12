import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { IconScale } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { listarCategoriasApi, listarTransacoesApi } from "@/features/transacoes/api/transacoes-api"
import { listarContasApi } from "@/features/contas/api/contas-api"
import { formatarMoeda } from "@/shared/lib/formatadores"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"

function obterDataLocal(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

export function PaginaOrcamentos() {
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

  const transacoes = transacoesQuery.data ?? []

  const agora = new Date()
  const mesAtual = agora.getMonth()
  const anoAtual = agora.getFullYear()

  // Gastos reais do mes atual agrupados por categoria
  const gastosPorCategoria = React.useMemo(() => {
    return transacoes
      .filter((item) => {
        const data = obterDataLocal(item.data)
        return (
          item.tipo === "despesa" &&
          data.getMonth() === mesAtual &&
          data.getFullYear() === anoAtual
        )
      })
      .reduce<Map<string, number>>((acc, item) => {
        const cat = item.categoria || "Sem categoria"
        acc.set(cat, (acc.get(cat) ?? 0) + item.valor)
        return acc
      }, new Map())
  }, [transacoes, mesAtual, anoAtual])

  const orcamentosCalculados = React.useMemo(() => {
    return Array.from(gastosPorCategoria.entries())
      .map(([categoria, realizado]) => ({
        categoria,
        realizado,
        // Sem API de orcamentos: planejado = 0 indica sem limite configurado
        planejado: 0,
      }))
      .sort((a, b) => b.realizado - a.realizado)
  }, [gastosPorCategoria])

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Orcamentos"
        descricao="Planejado vs realizado com alertas graduais de consumo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Metodo 50/30/20</CardTitle>
          <CardDescription>
            Recomendacao assistida para distribuicao da renda mensal.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[
            { nome: "Essenciais", valor: "50%", descricao: "Moradia, contas e saude" },
            { nome: "Estilo de vida", valor: "30%", descricao: "Lazer, viagens e compras" },
            { nome: "Investimentos", valor: "20%", descricao: "Metas e reserva" },
          ].map((item) => (
            <div
              key={item.nome}
              className="rounded-md border border-border/70 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">{item.nome}</p>
                <IconScale className="size-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-semibold">{item.valor}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.descricao}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos do mes por categoria</CardTitle>
          <CardDescription>
            Despesas reais registradas neste mes, agrupadas por categoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {transacoesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : orcamentosCalculados.length === 0 ? (
            <div className="rounded-md border border-border/70 p-4 text-sm text-muted-foreground">
              Nenhuma despesa registrada neste mes. Os gastos por categoria aparecerao aqui conforme as transacoes forem lancadas.
            </div>
          ) : (
            orcamentosCalculados.map((orcamento) => {
              const totalMes = Array.from(gastosPorCategoria.values()).reduce(
                (t, v) => t + v,
                0
              )
              const percentual =
                totalMes > 0 ? (orcamento.realizado / totalMes) * 100 : 0

              return (
                <div
                  key={orcamento.categoria}
                  className="rounded-md border border-border/70 p-4"
                >
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{orcamento.categoria}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatarMoeda(orcamento.realizado)} •{" "}
                        {percentual.toFixed(0)}% do total de despesas do mes
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {percentual.toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress value={percentual} />
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
