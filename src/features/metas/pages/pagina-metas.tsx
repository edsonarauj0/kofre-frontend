import { IconAward, IconTargetArrow } from "@tabler/icons-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CabecalhoPagina } from "@/shared/components/cabecalho-pagina"

export function PaginaMetas() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Metas financeiras"
        descricao="Planejamento de objetivos com contribuicao recorrente e projecao."
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Projecao de alcance</CardTitle>
            <CardDescription>
              Estimativa mensal baseada na contribuicao atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-80 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma meta cadastrada ainda.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gamificacao</CardTitle>
            <CardDescription>
              Sinais de consistencia das suas contribuicoes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <IconAward className="size-4 text-primary" />
                <p className="text-sm font-semibold">Badge de consistencia</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Complete metas para desbloquear badges de consistencia.
              </p>
            </div>
            <div className="rounded-md border border-border/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <IconTargetArrow className="size-4 text-primary" />
                <p className="text-sm font-semibold">Streak atual</p>
              </div>
              <p className="text-2xl font-semibold">-</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Carteira de metas</CardTitle>
          <CardDescription>
            Status individual, conta vinculada e prazo final.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/70 p-4 text-sm text-muted-foreground">
            Nenhuma meta cadastrada. Em breve sera possivel criar e acompanhar metas financeiras diretamente aqui.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
