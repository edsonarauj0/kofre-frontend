import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CardMetrica({
  titulo,
  valor,
  apoio,
  tendencia,
  icone,
  itens,
}: {
  titulo: string
  valor: string
  apoio: string
  tendencia?: string
  icone: ReactNode
  itens?: { rotulo: string; valor: string }[]
}) {
  return (
    <Card className="h-full rounded-[28px] border-border/70 bg-card/95 shadow-[0_18px_60px_-30px_rgba(0,0,0,0.45)] backdrop-blur">
      <CardHeader className="flex min-h-[160px] flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-3">
          <CardDescription className="text-[0.72rem] tracking-[0.22em] text-muted-foreground/90 uppercase">
            {titulo}
          </CardDescription>
          <CardTitle className="text-3xl tracking-tight md:text-[2rem]">
            {valor}
          </CardTitle>
          <p className="max-w-[28ch] text-sm leading-6 text-muted-foreground">
            {apoio}
          </p>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-muted-foreground shadow-inner shadow-black/5">
          {icone}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Atualizado com base nos dados sincronizados
          </span>
          {tendencia ? <Badge variant="secondary">{tendencia}</Badge> : null}
        </div>
        {itens?.length ? (
          <div className="grid gap-2 border-t border-border/60 pt-4">
            {itens.slice(0, 2).map((item) => (
              <div
                key={item.rotulo}
                className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/15 px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground">{item.rotulo}</span>
                <span className="font-medium">{item.valor}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
